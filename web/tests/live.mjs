// Read-only integration check. curl bridges this runner's restricted browser network;
// production uses the public RPC directly. No wallet is injected or connected here.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { decodeFunctionData, decodeFunctionResult, keccak256 } from "viem";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.join(root, "test/scratch/live");
fs.mkdirSync(out, { recursive: true });
const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
const contract = "0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30";
const abi = JSON.parse(
  fs.readFileSync(new URL("../src/abi.json", import.meta.url)),
);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const report = {
  capturedAt: new Date().toISOString(),
  rpc,
  contract,
  browserTransport:
    "Read-only requests forwarded unchanged through curl for this restricted runner; not part of the site.",
  state: {},
  logs: [],
  scriptErrors: [],
  failedLocalResources: [],
  rpcErrors: [],
};
const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  if (!urlPath.startsWith("/preview/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const filename = path.resolve(root, "dist", urlPath.slice(9) || "index.html");
  if (!filename.startsWith(path.join(root, "dist") + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      mime[path.extname(filename)] ?? "application/octet-stream",
    );
    res.end(fs.readFileSync(filename));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => report.scriptErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(url) && response.status() >= 400)
      report.failedLocalResources.push(response.url().slice(url.length));
  });
  await page.route(`${rpc}/**`, async (route) => {
    const request = route.request().postDataJSON();
    assert.ok(!Array.isArray(request));
    assert.ok(
      [
        "eth_chainId",
        "eth_getCode",
        "eth_getBlockByNumber",
        "eth_call",
        "eth_getLogs",
      ].includes(request.method),
    );
    if (["eth_call", "eth_getCode", "eth_getLogs"].includes(request.method)) {
      const target =
        request.method === "eth_call"
          ? request.params[0].to
          : request.method === "eth_getCode"
            ? request.params[0]
            : request.params[0].address;
      assert.equal(target.toLowerCase(), contract);
    }
    const { stdout } = await promisify(execFile)(
      "curl",
      [
        "-sS",
        "--fail-with-body",
        "--max-time",
        "25",
        "-H",
        "Content-Type: application/json",
        "--data",
        JSON.stringify(request),
        rpc,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const response = JSON.parse(stdout);
    if (response.error) {
      report.rpcErrors.push({ method: request.method, ...response.error });
      await route.fulfill({ contentType: "application/json", body: stdout });
      return;
    }
    if (request.method === "eth_chainId")
      report.state.chainId = Number(response.result);
    if (request.method === "eth_getCode")
      report.state.runtimeHash = keccak256(response.result);
    if (
      request.method === "eth_getBlockByNumber" &&
      request.params[0] === "latest"
    ) {
      report.state.block = Number(BigInt(response.result.number));
      report.state.timestamp = Number(BigInt(response.result.timestamp));
    }
    if (request.method === "eth_getLogs")
      report.logs.push({
        from: Number(BigInt(request.params[0].fromBlock)),
        to: Number(BigInt(request.params[0].toBlock)),
        count: response.result.length,
      });
    if (request.method === "eth_call") {
      const { functionName } = decodeFunctionData({
        abi,
        data: request.params[0].data,
      });
      const result = decodeFunctionResult({
        abi,
        functionName,
        data: response.result,
      });
      if (
        ["guildCount", "currentSeason", "minStakerPower"].includes(functionName)
      )
        report.state[functionName] = String(result);
    }
    await route.fulfill({ contentType: "application/json", body: stdout });
  });
  await page.goto(url);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForFunction(
      () => {
        const status = document.querySelector(".read-status");
        const refresh = status?.querySelector("button");
        return (
          refresh &&
          !refresh.disabled &&
          (status.classList.contains("has-error") ||
            status.textContent.includes("Sepolia · block"))
        );
      },
      undefined,
      { timeout: 60000 },
    );
    if (
      !(await page
        .locator(".read-status")
        .evaluate((el) => el.classList.contains("has-error")))
    )
      break;
    await page.getByRole("button", { name: "Refresh chain data" }).click();
  }
  await page.getByText(/Sepolia · block/).waitFor({ timeout: 60000 });
  assert.equal(report.state.chainId, 11155111);
  report.emptyStateObserved = report.state.guildCount === "0";
  if (report.emptyStateObserved)
    await page
      .getByRole("heading", {
        name: "No guild yet. Be the first to create one.",
      })
      .waitFor();
  await page.evaluate(() => document.fonts.ready);
  const emptyMessage = report.emptyStateObserved
    ? await page
        .getByRole("heading", {
          name: "No guild yet. Be the first to create one.",
        })
        .boundingBox()
    : undefined;
  if (emptyMessage) assert.ok(emptyMessage.y + emptyMessage.height <= 844);
  const cta = await page
    .getByRole("link", { name: "Create a guild", exact: true })
    .first()
    .boundingBox();
  report.firstScreen = {
    width: 390,
    height: 844,
    createButtonTop: cta.y,
    createButtonBottom: cta.y + cta.height,
    emptyMessageBottom: emptyMessage
      ? emptyMessage.y + emptyMessage.height
      : undefined,
    visible: cta.y + cta.height < 844,
  };
  assert.ok(report.firstScreen.visible);
  report.fonts = await page.evaluate(() =>
    [...document.fonts].map((face) => ({
      family: face.family,
      weight: face.weight,
      status: face.status,
    })),
  );
  await page.screenshot({ path: path.join(out, "live-390-first.png") });
  await page.screenshot({
    path: path.join(out, "live-390-full.png"),
    fullPage: true,
  });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.screenshot({ path: path.join(out, "keyboard-focus-390.png") });
  report.keyboardFocus = await page.evaluate(() => ({
    text: document.activeElement.textContent.trim(),
    outline: getComputedStyle(document.activeElement).outlineStyle,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
  }));
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: path.join(out, "wallet-390.png") });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  report.widths = [];
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const content = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    assert.ok(content <= width);
    report.widths.push({ viewport: width, content });
  }
  await page.screenshot({
    path: path.join(out, "live-1440.png"),
    fullPage: true,
  });
  assert.deepEqual(report.scriptErrors, []);
  assert.deepEqual(report.failedLocalResources, []);
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.writeFileSync(
    path.join(out, "live-read.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (browser) await browser.close();
  server.close();
}
