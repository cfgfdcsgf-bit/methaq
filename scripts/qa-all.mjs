import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run this check with pnpm qa.");

function run(command, args) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const script of ["check", "test", "build"]) run(process.execPath, [pnpm, script]);
run(process.execPath, ["scripts/verify-project.mjs", "--build"]);
if (process.argv.includes("--migrate")) run(process.execPath, [pnpm, "db:migrate"]);
if (process.argv.includes("--browser")) run(process.execPath, [pnpm, "test:e2e"]);
