// import "./logger";
import "./err";
import "./env";
import express, { Request, Response, NextFunction } from "express";
import compression from "compression";
import { Server } from "socket.io";
import http from "node:http";
import os from "node:os";
import expressWs from "express-ws";
import logger from "morgan";
import cors from "cors";
import buildRoute from "@/core";
import path from "path";
import fs from "fs";
import u from "@/utils";
import jwt from "jsonwebtoken";
import socketInit from "@/socket/index";
import { isEletron } from "@/utils/getPath";
import { ensureThumbnail, ThumbnailSize } from "@/utils/image";
import { initEmbedding } from "@/utils/agent/embedding";
import { warmSandboxConfig } from "@/utils/vm";

const app = express();
const server = http.createServer(app);

async function checkPermissions() {
  if (!isEletron()) return true;
  const userDataPath = u.getPath();
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    const testFile = path.join(userDataPath, ".access_test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
  } catch (e) {
    const { dialog, app } = require("electron");
    const { response } = await dialog.showMessageBox({
      type: "warning",
      title: "权限不足",
      message: "应用无法访问数据目录",
      detail: `无法读写以下目录：\n${userDataPath}\n\n请联系管理员授予权限，或以管理员身份运行本程序。`,
      buttons: ["确认退出"],
      defaultId: 0,
    });
    if (response === 0) {
      app.quit();
    }
  }
}

export default async function startServe(randomPort: Boolean = false, preferredPort: number = 10588) {
  await checkPermissions();

  await u.writeVersion();

  // 后台预热 embedding 模型（延迟 5s 启动，失败不影响服务），避免首个记忆/向量请求卡顿
  setTimeout(() => {
    initEmbedding().catch((e: Error) => console.warn("[Embedding] 预热失败:", e?.message));
  }, 5000);
  // 预热沙箱配置（引擎/超时读入缓存，DB 已就绪，避免首个调用走默认值）
  warmSandboxConfig();
  // maxHttpBufferSize: 100MB，防止分镜面板等大工作区数据超过默认 1MB 限制导致 Socket 连接断开
  // pingTimeout: 60s，避免大任务执行时事件循环短暂阻塞导致的误判断线
  const io = new Server(server, {
    cors: { origin: "*" },
    path: "/api/socket.io",
    maxHttpBufferSize: 100 * 1024 * 1024,
    pingInterval: 25000,
    pingTimeout: 60000,
  });
  socketInit(io);

  if (process.env.NODE_ENV == "dev") await buildRoute();

  expressWs(app);

  app.use(logger("dev"));
  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // gzip 压缩：仅压缩文本类响应（js/css/json/svg/字体等），跳过图片/视频等已压缩资源，降低 CPU 开销
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        // WebSocket 握手不压缩
        if (req.headers.upgrade) return false;
        const type = (res.getHeader("Content-Type") as string) || "";
        return /(text|javascript|json|xml|svg|font|wasm)/i.test(type);
      },
    }),
  );

  // oss 静态资源
  const ossDir = u.getPath("oss");
  if (!fs.existsSync(ossDir)) {
    fs.mkdirSync(ossDir, { recursive: true });
  }
  console.log("文件目录:", ossDir);
  app.use(
    "/oss",
    (req, res, next) => {
      // 如果传参 type=small，则返回小图
      if (req.query.size) {
        const size = req.query.size as string;
        const smallImageBaseDir = path.join(ossDir, "smallImage");
        const originalPath = path.join(ossDir, req.path);

        // 解析 size 参数
        let sizeSubDir: string;
        let sizeOpts: ThumbnailSize | undefined;

        // 判断是否为 WIDTHxHEIGHT 格式，如 "200x300"：等比压缩到指定宽高边界
        const dimensMatch = size.match(/^(\d+)x(\d+)$/i);
        // 判断是否为百分比格式，如 "30"、"30%"：等比压缩到原图的指定百分比
        const percentMatch = size.match(/^(\d+(?:\.\d+)?)\s*%?$/);

        if (dimensMatch) {
          const w = parseInt(dimensMatch[1], 10);
          const h = parseInt(dimensMatch[2], 10);
          sizeSubDir = `${w}x${h}`;
          sizeOpts = { type: "dimensions", width: w, height: h };
        } else if (percentMatch) {
          const pct = parseFloat(percentMatch[1]);
          sizeSubDir = `${percentMatch[1]}p`;
          sizeOpts = { type: "percentage", value: pct };
        } else {
          // 无效的 size 参数，降级返回原图
          express.static(ossDir, { acceptRanges: true })(req, res, next);
          return;
        }

        const ext = path.extname(req.path);
        const base = path.basename(req.path, ext);
        const dir = path.dirname(req.path);
        const smallImagePath = path.join(smallImageBaseDir, dir, `${base}_${sizeSubDir}${ext}`);

        ensureThumbnail(originalPath, smallImagePath, sizeOpts).then((thumbnailPath) => {
          if (thumbnailPath) {
            res.sendFile(thumbnailPath);
          } else {
            // 缩略图生成失败，降级返回原图
            express.static(ossDir, { acceptRanges: true })(req, res, next);
          }
        });
        return;
      }
      next();
    },
    express.static(ossDir, { acceptRanges: true }),
  );
  // skills 静态资源
  const skillsDir = u.getPath("skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  console.log("文件目录:", skillsDir);
  // 只允许图片文件访问
  app.use(
    "/skills",
    (req, res, next) => {
      /\.(jpe?g|png|gif|webp|svg|ico|bmp)$/i.test(req.path) ? next() : res.status(403).end();
    },
    express.static(skillsDir, { acceptRanges: true }),
  );

  // assets 静态资源
  const assetsDir = u.getPath("assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  console.log("文件目录:", assetsDir);
  app.use("/assets", express.static(assetsDir, { acceptRanges: true }));

  // data/web 静态网站
  const webDir = u.getPath("web");
  if (fs.existsSync(webDir)) {
    console.log("静态网站目录:", webDir);
    app.use(express.static(webDir, { acceptRanges: true }));
  } else {
    console.warn("静态网站目录不存在:", webDir);
  }

  // tokenKey 缓存：避免每个 API 请求都查询 o_setting（TTL 60s，兼顾运行时可能的密钥变更）
  let cachedTokenKey: string | null = null;
  let tokenKeyCacheTime = 0;
  const TOKEN_KEY_TTL = 60_000;
  async function getTokenKey(): Promise<string | null> {
    const now = Date.now();
    if (cachedTokenKey !== null && now - tokenKeyCacheTime < TOKEN_KEY_TTL) return cachedTokenKey;
    const setting = await u.db("o_setting").where("key", "tokenKey").select("value").first();
    cachedTokenKey = setting ? String(setting.value) : null;
    tokenKeyCacheTime = now;
    return cachedTokenKey;
  }

  app.use(async (req, res, next) => {
    const tokenKey = await getTokenKey();
    if (!tokenKey) return res.status(444).send({ message: "服务器秘钥未配置，请联系管理员" });
    // 从 header 或 query 参数获取 token
    const rawToken = req.headers.authorization || (req.query.token as string) || "";
    const token = rawToken.replace("Bearer ", "");
    // 白名单路径
    if (req.path === "/api/login/login") return next();
    // 静态资源（非 API 路径）公开访问，无需鉴权
    if (!req.path.startsWith("/api")) return next();

    if (!token) return res.status(401).send({ message: "未提供token" });
    try {
      const decoded = jwt.verify(token, tokenKey as string);
      (req as any).user = decoded;
      next();
    } catch (err) {
      return res.status(401).send({ message: "无效的token" });
    }
  });

  const router = await import("@/router");
  await router.default(app);

  // 404 处理
  app.use((_, res, next: NextFunction) => {
    return res.status(404).send({ message: "API 404 Not Found" });
  });

  // 错误处理
  app.use((err: any, _: Request, res: Response, __: NextFunction) => {
    res.locals.message = err.message;
    res.locals.error = err;
    console.error(err);
    res.status(err.status || 500).send(err);
  });

  // 默认固定 10588 端口（桌面端便于前端以 /api 访问），被占用时自动降级随机端口
  const port = randomPort ? 0 : preferredPort;
  return await new Promise((resolve, reject) => {
    const tryListen = (p: number) => {
      server.once("error", (err: any) => {
        if (err?.code === "EADDRINUSE" && p !== 0) {
          console.warn(`端口 ${p} 被占用，已自动切换随机端口`);
          tryListen(0);
        } else {
          reject(err);
        }
      });
      server.listen(p, async () => {
        server.removeAllListeners("error");
        const address = server.address();
        const realPort = typeof address === "string" ? address : address?.port;
        const localUrl = `http://localhost:${realPort}`;
        const lanIps = [
          ...new Set(
            Object.values(os.networkInterfaces())
              .flatMap((nets) => nets ?? [])
              .filter((net) => net.family === "IPv4" && !net.internal)
              .map((net) => net.address),
          ),
        ];
        console.log("");
        console.log("  Hopeflow 服务已启动");
        console.log(`  本地访问:   ${localUrl}`);
        for (const ip of lanIps) {
          console.log(`  局域网访问: http://${ip}:${realPort}`);
        }
        console.log("");
        resolve(realPort);
      });
    };
    tryListen(port);
  });
}

// 支持await关闭
export function closeServe(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err?: Error) => {
        if (err) return reject(err);
        console.log("[服务已关闭]");
        resolve();
      });
    } else {
      resolve();
    }
  });
}

const isElectron = typeof process.versions?.electron !== "undefined";
if (!isElectron) startServe();
