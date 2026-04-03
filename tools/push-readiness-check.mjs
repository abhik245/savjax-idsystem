import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function isExampleEnv(filePath) {
  return /(^|\/)\.env(\.[^.\/]+)*\.example$/i.test(filePath) || /(^|\/)\.env\.template$/i.test(filePath);
}

function isPlaceholderValue(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return [
    "<",
    "replace_with",
    "example",
    "changeme",
    "your_",
    "localhost",
    "postgresql://postgres:postgres@localhost",
    "http://localhost",
    "false",
    "true"
  ].some((token) => normalized.includes(token));
}

const trackedFiles = runGit(["ls-files"])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const forbiddenTrackedPathMatchers = [
  { regex: /(^|\/)\.env($|(\.[^.\/]+$))/i, reason: "tracked env file" },
  { regex: /(^|\/)uploads\//i, reason: "tracked upload artifact" },
  { regex: /(^|\/)\.generated\//i, reason: "tracked generated runtime artifact" },
  { regex: /(^|\/)\.next\//i, reason: "tracked Next.js build artifact" },
  { regex: /(^|\/)dist\//i, reason: "tracked compiled build artifact" },
  { regex: /(^|\/)node_modules\//i, reason: "tracked dependency folder" }
];

const contentPatterns = [
  { regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, reason: "private key block" },
  { regex: /\bAKIA[0-9A-Z]{16}\b/, reason: "AWS access key" },
  { regex: /\bghp_[A-Za-z0-9]{36,}\b/, reason: "GitHub personal access token" },
  { regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/, reason: "GitHub fine-grained token" },
  { regex: /\bsk_live_[A-Za-z0-9]+\b/, reason: "live secret key" },
  { regex: /\brk_live_[A-Za-z0-9]+\b/, reason: "live restricted key" },
  { regex: /\bxox[baprs]-[A-Za-z0-9-]+\b/, reason: "Slack token" },
  { regex: /\bAIza[0-9A-Za-z\-_]{35}\b/, reason: "Google API key" }
];

const sensitiveAssignments = [
  "JWT_ACCESS_SECRET",
  "FIELD_ENCRYPTION_KEY",
  "ASSET_SIGNING_SECRET",
  "DIGITAL_ID_SECRET",
  "RAZORPAY_KEY_SECRET",
  "AWS_SECRET_ACCESS_KEY",
  "TWILIO_AUTH_TOKEN",
  "SMTP_PASSWORD",
  "DATABASE_URL"
];

const trackedPathProblems = [];
const contentProblems = [];

for (const file of trackedFiles) {
  for (const matcher of forbiddenTrackedPathMatchers) {
    if (matcher.regex.test(file)) {
      if (matcher.reason === "tracked env file" && isExampleEnv(file)) {
        continue;
      }
      trackedPathProblems.push(`${file} -> ${matcher.reason}`);
    }
  }

  let contents;
  try {
    contents = readFileSync(path.join(repoRoot, file), "utf8");
  } catch {
    continue;
  }

  for (const pattern of contentPatterns) {
    if (pattern.regex.test(contents)) {
      contentProblems.push(`${file} -> ${pattern.reason}`);
    }
  }

  const lines = contents.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const key of sensitiveAssignments) {
      const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
      if (!match) continue;
      const value = match[1] ?? "";
      if (!isPlaceholderValue(value)) {
        contentProblems.push(`${file}:${index + 1} -> suspicious ${key} assignment`);
      }
    }
  });
}

if (!trackedPathProblems.length && !contentProblems.length) {
  console.log("Push readiness check passed.");
  process.exit(0);
}

console.error("Push readiness check failed.\n");

if (trackedPathProblems.length) {
  console.error("Tracked path issues:");
  for (const problem of trackedPathProblems) {
    console.error(`- ${problem}`);
  }
  console.error("");
}

if (contentProblems.length) {
  console.error("Potential secret/content issues:");
  for (const problem of contentProblems) {
    console.error(`- ${problem}`);
  }
  console.error("");
}

process.exit(1);
