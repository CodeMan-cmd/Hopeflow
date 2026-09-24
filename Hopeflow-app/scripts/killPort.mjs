/**
 * 启动前自动释放端口占用，避免 listen EADDRINUSE 报错
 * 用法：node scripts/killPort.mjs [端口...]（默认清理 10588 与 9229）
 * 跨平台：macOS/Linux 用 lsof，Windows 用 netstat + taskkill
 */
import { execSync } from "node:child_process";

const isWindows = process.platform === "win32";
const defaultPorts = [10588, 9229];
const targetPorts = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
const ports = targetPorts.length ? targetPorts : defaultPorts;

/** 获取占用指定端口的进程 PID 列表 */
function getPidsByPort(port) {
  if (isWindows) {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        // 形如： TCP    0.0.0.0:10588   0.0.0.0:0   LISTENING   12345
        const match = line.trim().match(/(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }
      return [...pids];
    } catch {
      // 无进程占用该端口（findstr 无匹配返回非零）
      return [];
    }
  }
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    // 无进程占用该端口（lsof 无匹配返回非零）
    return [];
  }
}

/** 终止指定 PID */
function killPid(pid) {
  if (isWindows) {
    execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
  } else {
    process.kill(Number(pid), "SIGKILL");
  }
}

for (const port of ports) {
  const pids = getPidsByPort(port);
  if (!pids.length) continue;
  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`[killPort] 已释放端口 ${port}，终止进程 PID=${pid}`);
    } catch (err) {
      console.warn(`[killPort] 终止进程 PID=${pid} 失败: ${err.message}`);
    }
  }
}
