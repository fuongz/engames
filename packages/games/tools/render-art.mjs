#!/usr/bin/env node
// `bun run art` — renders each game's cover.ts in headless Chrome and writes
// src/<slug>/poster.webp and banner.webp. Re-run after changing a game's art.
// Needs Google Chrome (override the path with CHROME_PATH).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const root = new URL("..", import.meta.url).pathname;
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await createServer({ root, server: { port: 0 }, logLevel: "error" });
await server.listen();
const url = `${server.resolvedUrls.local[0]}tools/render-art.html`;

const profile = mkdtempSync(join(tmpdir(), "engames-art-"));
const chrome = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, url], {
  stdio: ["ignore", "ignore", "pipe"],
});
// Chrome prints its DevTools endpoint on stderr
const endpoint = await new Promise((resolve, reject) => {
  chrome.stderr.on("data", (d) => {
    const m = String(d).match(/ws:\/\/[^\s]+/);
    if (m) resolve(m[0]);
  });
  chrome.on("exit", () => reject(new Error("Chrome exited before DevTools was ready")));
});

try {
  const port = new URL(endpoint).port;
  let art = null;
  for (let i = 0; i < 60 && !art; i++) {
    await sleep(500);
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    if (!page) continue;
    art = await evaluate(page.webSocketDebuggerUrl, "window.__art ?? null");
  }
  if (!art) throw new Error("render-art.html never produced art (check the browser console)");
  for (const [slug, images] of Object.entries(art)) {
    for (const [name, dataUrl] of Object.entries(images)) {
      const file = join(root, "src", slug, `${name}.webp`);
      writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
      console.log("wrote", file.replace(root, ""));
    }
  }
} finally {
  const exited = new Promise((r) => chrome.once("exit", r));
  chrome.kill();
  await exited; // Chrome keeps writing to its profile until it is gone
  await server.close();
  rmSync(profile, { recursive: true, force: true });
}

async function evaluate(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const reply = new Promise((r) => ws.addEventListener("message", (e) => r(JSON.parse(e.data)), { once: true }));
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  const msg = await reply;
  ws.close();
  return msg.result?.result?.value ?? null;
}
