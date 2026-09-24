import { app, BrowserWindow, protocol, systemPreferences } from "electron";
import path from "path";
import fs from "fs";
import Module from "module";
import os from "os";

// 加速 Electron 启动：跳过 GPU 信息收集，减少初始化耗时
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

// 数据目录可写性保障：
// 1. 支持 HOPEFLOW_USER_DATA 环境变量显式指定数据目录（优先）
// 2. userData 不可写时（如受限/只读环境）回退到“文档/Hopeflow-data”，仍不可写则回退到临时目录，
//    确保后端服务能初始化，避免出现“前端已加载但后端无法启动”的情况
function ensureUserDataWritable(): void {
  const explicit = process.env.HOPEFLOW_USER_DATA;
  if (explicit) {
    app.setPath("userData", path.resolve(explicit));
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    return;
  }
  const userData = app.getPath("userData");
  const probe = (dir: string): boolean => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probeFile = path.join(dir, ".access_probe");
      fs.writeFileSync(probeFile, "1");
      fs.unlinkSync(probeFile);
      return true;
    } catch {
      return false;
    }
  };
  if (probe(userData)) return;
  let fallback = path.join(app.getPath("documents"), "Hopeflow-data");
  if (!probe(fallback)) {
    fallback = path.join(os.tmpdir(), "Hopeflow-data");
    probe(fallback);
  }
  app.setPath("userData", fallback);
  console.warn(`[数据目录] userData 不可写，已回退到: ${fallback}`);
}

ensureUserDataWritable();

// 读取 GPU 硬件加速配置（gpuConfig.json 由后端设置中心写入）
// 需在 app ready 之前同步读取并应用，否则 Chromium 开关不生效
let gpuConfig: { hardwareAccelerate?: string } = {};
try {
  gpuConfig = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "data", "gpuConfig.json"), "utf-8"));
} catch {}
if (gpuConfig.hardwareAccelerate === "0") {
  // 关闭渲染硬件加速
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
} else {
  // 开启/默认：增强页面渲染与 2D 画布加速
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-accelerated-2d-canvas");
  app.commandLine.appendSwitch("enable-zero-copy");
}

const TARGET_ENTRIES = new Set(["assets", "models", "serve", "skills", "web", "vendor", "modelPrompt"]);

async function copyDir(src: string, dest: string): Promise<void> {
  if (!fs.existsSync(src)) return;
  await fs.promises.mkdir(dest, { recursive: true });
  // 异步递归拷贝；force:false + errorOnExist:false = 目标已存在则跳过，与原同步实现行为一致
  await fs.promises.cp(src, dest, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
}

declare const __APP_VERSION__: string | undefined;

// 开发环境（tsx 运行）__APP_VERSION__ 未定义，回退读取 package.json 版本
const APP_VERSION: string = (() => {
  if (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) return __APP_VERSION__;
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

function compareVersions(a: string, b: string): number {
  const pa = a
    .split(".")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  const pb = b
    .split(".")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

async function initializeData(): Promise<void> {
  const srcDir = app.isPackaged ? path.join(process.resourcesPath, "data") : path.join(process.cwd(), "data");
  const destDir = path.join(app.getPath("userData"), "data");
  const versionFilePath = path.join(destDir, "version.txt");

  let shouldForceReplace = false;
  if (!fs.existsSync(versionFilePath)) {
    shouldForceReplace = true;
  } else {
    const localVersion = fs.readFileSync(versionFilePath, "utf-8").trim();
    if (compareVersions(localVersion, APP_VERSION) < 0) {
      shouldForceReplace = true;
    }
  }

  for (const dir of TARGET_ENTRIES) {
    const targetDir = path.join(destDir, dir);
    if (shouldForceReplace) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      await copyDir(path.join(srcDir, dir), targetDir);
      continue;
    }
    if (!fs.existsSync(targetDir)) {
      await copyDir(path.join(srcDir, dir), targetDir);
    }
  }

  if (shouldForceReplace) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(versionFilePath, `${APP_VERSION}\n`, "utf-8");
  }
}

//获取全部依赖路径，优先从 unpacked 加载原生模块，其他模块从 asar 加载
function getNodeModulesPaths(): string[] {
  const paths: string[] = [];
  if (app.isPackaged) {
    // external 依赖（原生模块）在 unpacked 目录
    const unpackedNodeModules = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
    if (fs.existsSync(unpackedNodeModules)) {
      paths.push(unpackedNodeModules);
    }
    // 普通依赖在 asar 内
    const asarNodeModules = path.join(process.resourcesPath, "app.asar", "node_modules");
    paths.push(asarNodeModules);
  } else {
    paths.push(path.join(process.cwd(), "node_modules"));
  }
  return paths;
}

//动态加载
function requireWithCustomPaths(modulePath: string): any {
  const appNodeModulesPaths = getNodeModulesPaths();
  // 保存原始方法
  const originalNodeModulePaths = (Module as any)._nodeModulePaths;
  // 临时修改模块路径解析
  (Module as any)._nodeModulePaths = function (from: string): string[] {
    const paths = originalNodeModulePaths.call(this, from);
    // 将主程序的 node_modules 添加到前面
    for (let i = appNodeModulesPaths.length - 1; i >= 0; i--) {
      const p = appNodeModulesPaths[i];
      if (!paths.includes(p)) {
        paths.unshift(p);
      }
    }
    return paths;
  };
  try {
    // 清除缓存确保加载最新
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    // 恢复原始方法
    (Module as any)._nodeModulePaths = originalNodeModulePaths;
  }
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 500,
      // macOS 使用系统原生红绿灯按钮(含全屏)，放在窗口左侧；Windows/Linux 保持无边框+自定义按钮
      frame: process.platform === "darwin",
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
      trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 10 } : undefined,
      show: false,
      autoHideMenuBar: true,
      resizable: true,
      thickFrame: true,
    });
    mainWindow = win;
    win.setMenuBarVisibility(false);
    win.removeMenu();

    win.on("closed", () => {
      mainWindow = null;
    });

    win.once("ready-to-show", () => {
      win.show();
      resolve();
    });

    const isDev = process.env.NODE_ENV === "dev" || !app.isPackaged;
    if (process.env.VITE_DEV) {
      void win.loadURL("http://localhost:50188");
    } else {
      const htmlPath = isDev
        ? path.join(process.cwd(), "data", "web", "index.html")
        : path.join(app.getPath("userData"), "data", "web", "index.html");
      void win.loadFile(htmlPath);
    }
  });
}

let closeServeFn: (() => Promise<void>) | undefined;

// 注意：scheme 必须使用小写。Chromium 解析 URL 时会将 scheme 转为小写再匹配，
// 若注册大写 "Hopeflow"，前端 fetch("Hopeflow://getAppUrl") 会因找不到小写 "hopeflow" 而失败
protocol.registerSchemesAsPrivileged([
  {
    scheme: "hopeflow",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(async () => {
  try {
    let servePath: string;
    if (app.isPackaged) {
      servePath = path.join(app.getPath("userData"), "data", "serve", "app.js");
    } else {
      // 开发环境：直接加载源码（tsx 通过 -r tsx 注册了 require 钩子）
      servePath = path.join(process.cwd(), "src", "app.ts");
    }
    // 让出主线程一次，确保 loading 窗口渲染后再做耗时文件拷贝（首次会把种子数据同步到 userData）
    await new Promise((r) => setTimeout(r, 0));
    await initializeData();
    // 使用自定义路径加载模块
    const mod = requireWithCustomPaths(servePath);
    closeServeFn = mod.closeServe;
    // 固定 10588 端口（后端 app.ts 内部已做端口占用自动降级随机），便于前端默认以 /api 访问
    const port = await mod.default(false, 10588);
    process.env.PORT = port;
    // 注册协议处理器
    protocol.handle("hopeflow", async (request) => {
      const url = new URL(request.url);
      const pathname = url.hostname.toLowerCase();
      const handlers: Record<string, () => object | Promise<object>> = {
        getappurl: () => ({ url: process.env.URL ?? `http://localhost:${port}/api` }),
        windowminimize: () => {
          mainWindow?.minimize();
          return { ok: true };
        },
        windowmaximize: () => {
          if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
          } else {
            mainWindow?.maximize();
          }
          return { ok: true };
        },
        windowclose: () => {
          app.exit(0);
          return { ok: true };
        },
        apprestart: () => {
          // 延迟执行，让响应先返回给前端
          setTimeout(() => {
            app.relaunch();
            app.exit(0);
          }, 500);
          return { ok: true, message: "应用即将重启" };
        },
        windowismaximized: () => ({
          maximized: mainWindow?.isMaximized() ?? false,
        }),
        windowisfullscreen: () => ({
          fullscreen: mainWindow?.isFullScreen() ?? false,
        }),
        opendevtool: () => {
          mainWindow?.webContents.openDevTools();
          return { ok: true };
        },
        openurlwithbrowser: () => {
          const search = url.searchParams;
          const targetUrl = search.get("url");
          if (targetUrl) {
            const { shell } = require("electron");
            shell.openExternal(targetUrl);
            return { ok: true };
          } else {
            return { ok: false, error: "缺少url参数" };
          }
        },
        getlocallanguage: () => {
          // 获取应用区域设置

          // macOS系统特定方法
          if (process.platform === "darwin") {
            const systemLocale = systemPreferences.getUserDefault("AppleLocale", "string");
            return { ok: true, local: systemLocale };
          }
          const appLocale = app.getLocale();
          return { ok: true, local: appLocale };
        },
        getgpuinfo: async () => {
          // 获取 GPU 基本信息（型号、驱动等），供前端 GPU 环境检测展示
          const gpuInfo = await app.getGPUInfo("basic").catch(() => null);
          return { ok: true, gpuInfo };
        },
      };

      const handler = handlers[pathname];

      const responseData = handler ? await handler() : { error: "未知接口" };
      return new Response(JSON.stringify(responseData), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    });

    // 服务启动成功，创建主窗口（主窗口 ready-to-show 时自动关闭loading）
    await createMainWindow();
  } catch (err) {
    console.error("[服务启动失败]:", err);
    await createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("before-quit", async (event) => {
  if (closeServeFn) await closeServeFn();
});
