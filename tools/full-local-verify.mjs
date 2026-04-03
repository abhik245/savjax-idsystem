import { existsSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import net from "net";

const ROOT = resolve(process.cwd());
const API_DIR = resolve(ROOT, "apps", "api");
const WEB_DIR = resolve(ROOT, "apps", "web");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd) {
  const printable = [command, ...args].join(" ");
  console.log(`\n> ${cwd.replace(`${ROOT}\\`, "").replace(`${ROOT}/`, "") || "."}: ${printable}`);
  const result = spawnSync(printable, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? "unknown"}): ${printable}`);
  }
}

function runStatus(command, args, cwd) {
  const printable = [command, ...args].join(" ");
  console.log(`\n> ${cwd.replace(`${ROOT}\\`, "").replace(`${ROOT}/`, "") || "."}: ${printable}`);
  const result = spawnSync(printable, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  return result.status ?? 1;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function checkPort(port) {
  return new Promise((resolvePort) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket
      .once("connect", () => {
        socket.destroy();
        resolvePort(true);
      })
      .once("timeout", () => {
        socket.destroy();
        resolvePort(false);
      })
      .once("error", () => {
        resolvePort(false);
      })
      .connect(port, "127.0.0.1");
  });
}

async function main() {
  if (!existsSync(API_DIR) || !existsSync(WEB_DIR)) {
    throw new Error("Expected monorepo apps/api and apps/web directories were not found.");
  }

  const apiUp = await checkPort(4000);
  const webUp = await checkPort(3000);
  if (!apiUp || !webUp) {
    const missing = [!apiUp ? "API :4000" : null, !webUp ? "Web :3000" : null].filter(Boolean).join(", ");
    throw new Error(
      `Local servers must be running before full verification. Missing: ${missing}. Start apps/api and apps/web first.`
    );
  }

  run(npmCmd, ["run", "build"], API_DIR);
  await restartApiServer();
  run(npmCmd, ["run", "build"], WEB_DIR);
  await restartWebDevServer();
  run(npmCmd, ["run", "test:security"], API_DIR);
  run(npmCmd, ["run", "test:auth:reset"], API_DIR);
  await restartApiServer();

  let finalSweepStatus = runStatus("node", ["tools/phase16_30_full_check.mjs"], ROOT);
  if (finalSweepStatus !== 0) {
    console.warn("\nFinal route sweep reported a transient failure. Waiting briefly and retrying once.");
    await sleep(5000);
    finalSweepStatus = runStatus("node", ["tools/phase16_30_full_check.mjs"], ROOT);
  }
  if (finalSweepStatus !== 0) {
    throw new Error("Command failed after retry: node tools/phase16_30_full_check.mjs");
  }
  run(npmCmd, ["run", "test:security:http"], API_DIR);

  console.log("\nFull local verification completed successfully.");
  console.log("Reports:");
  console.log("- docs/PHASE_16_30_FINAL_CHECK_REPORT.json");
  console.log("- docs/PHASE_16_30_FINAL_CHECK_REPORT.md");
}

async function restartWebDevServer() {
  if (process.platform !== "win32") {
    return;
  }

  const escapedNextDir = resolve(WEB_DIR, ".next").replace(/'/g, "''");
  const escapedWebDir = WEB_DIR.replace(/'/g, "''");
  const restartScript = [
    "$proc = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess",
    "if ($proc) { Stop-Process -Id $proc -Force }",
    `Remove-Item -LiteralPath '${escapedNextDir}' -Recurse -Force -ErrorAction SilentlyContinue`,
    `Start-Process -WindowStyle Hidden -FilePath powershell -ArgumentList '-NoProfile','-Command','Set-Location ''${escapedWebDir}''; npm run dev'`
  ].join("; ");

  console.log("\n> Restarting web dev server to keep the live route sweep stable after build");
  const restart = spawnSync("powershell", ["-NoProfile", "-Command", restartScript], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (restart.status !== 0) {
    throw new Error("Failed to restart web dev server after build");
  }

  const ready = await waitForPort(3000, 30000);
  if (!ready) {
    throw new Error("Web dev server did not come back on :3000 after restart");
  }
}

async function restartApiServer() {
  if (process.platform !== "win32") {
    return;
  }

  const escapedApiDir = API_DIR.replace(/'/g, "''");
  const restartScript = [
    "$proc = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess",
    "if ($proc) { Stop-Process -Id $proc -Force }",
    `Start-Process -WindowStyle Hidden -FilePath powershell -ArgumentList '-NoProfile','-Command','Set-Location ''${escapedApiDir}''; npm run start'`
  ].join("; ");

  console.log("\n> Restarting API server to clear runtime-only rate-limit state before live verification");
  const restart = spawnSync("powershell", ["-NoProfile", "-Command", restartScript], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (restart.status !== 0) {
    throw new Error("Failed to restart API server after build");
  }

  const ready = await waitForPort(4000, 30000);
  if (!ready) {
    throw new Error("API server did not come back on :4000 after restart");
  }
}

async function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await checkPort(port)) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

main().catch((error) => {
  console.error(`\nFull local verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
