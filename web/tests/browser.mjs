// Serves the committed production export at a subpath and closes all resources on exit.
// Fixture names/addresses never enter the application bundle or public live views.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { decodeEventLog, decodeFunctionData, keccak256, toHex } from "viem";
import {
  ABI,
  A,
  B,
  C,
  D,
  CONTRACT,
  RPC,
  fixture,
  injectWallet,
} from "./fixtures.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.join(root, "test/scratch/ui");
fs.mkdirSync(out, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  if (!pathname.startsWith("/preview/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const file = path.resolve(
    root,
    "dist",
    pathname.slice("/preview/".length) || "index.html",
  );
  if (!file.startsWith(path.join(root, "dist") + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] ?? "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
let browser;
const contexts = [];
const errors = [];
async function step(name, fn) {
  try {
    const result = await fn();
    if (result?.skipped) {
      results.push({ name, ...result });
      console.log(`SKIP ${name}: ${result.reason}`);
    } else {
      results.push({ name, passed: true });
      console.log(`PASS ${name}`);
    }
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}
async function setup(mode = "populated", wallet = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  contexts.push(context);
  const data = fixture(mode);
  await injectWallet(context, wallet);
  await context.route(`${RPC}/**`, async (route) => {
    try {
      const request = route.request().postDataJSON();
      const response = Array.isArray(request)
        ? await Promise.all(request.map(data.rpc))
        : await data.rpc(request);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } catch (error) {
      errors.push(error.message);
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(url) && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(url);
  await page.getByText(/Sepolia · block/).waitFor({ timeout: 20000 });
  return { context, page, data };
}
async function connect(page) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Test browser wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "0x1111…1111", exact: true })
    .waitFor();
  // A refresh after connecting reads members(address) before enabling guild actions.
  await page
    .getByRole("button", { name: "Refresh chain data" })
    .waitFor({ state: "visible" });
}
async function noOverflow(page, width) {
  await page.setViewportSize({ width, height: 900 });
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(
    sizes.content <= sizes.viewport,
    `overflow at ${width}: ${JSON.stringify(sizes)}`,
  );
}

try {
  browser = await chromium.launch({ headless: true });
  const empty = await setup("empty");
  await step(
    "empty registry is honest; product + create action fit the first 390px screen",
    async () => {
      await empty.page
        .getByRole("heading", {
          name: "No guild yet. Be the first to create one.",
        })
        .waitFor();
      assert.equal(await empty.page.locator("table tbody tr").count(), 0);
      await empty.page.evaluate(() => document.fonts.ready);
      const emptyMessage = await empty.page
        .getByRole("heading", {
          name: "No guild yet. Be the first to create one.",
        })
        .boundingBox();
      assert.ok(emptyMessage.y + emptyMessage.height <= 844);
      const box = await empty.page
        .getByRole("link", { name: "Create a guild", exact: true })
        .first()
        .boundingBox();
      assert.ok(box.y + box.height < 844);
      assert.ok(
        await empty.page
          .getByRole("link", { name: "Squeek Guild Wars home" })
          .isVisible(),
      );
      for (const width of [320, 390, 760, 1440])
        await noOverflow(empty.page, width);
      await empty.page.setViewportSize({ width: 390, height: 844 });
      await empty.page.screenshot({
        path: path.join(out, "empty-390.png"),
        fullPage: true,
      });
    },
  );
  await step("rankings filters have a clear recovery path", async () => {
    await empty.page
      .getByRole("searchbox", { name: "Search guilds" })
      .fill("nonexistent");
    await empty.page
      .getByRole("heading", { name: "No matching guilds" })
      .waitFor();
    await empty.page.getByRole("button", { name: "clear filters" }).click();
    await empty.page
      .getByRole("heading", {
        name: "No guild yet. Be the first to create one.",
      })
      .waitFor();
  });
  await step(
    "create navigation, wallet discovery, keyboard close, focus restoration, and form validation",
    async () => {
      await empty.page
        .getByRole("link", { name: "Create a guild", exact: true })
        .first()
        .click();
      await empty.page
        .getByRole("button", { name: "Connect to create" })
        .click();
      await empty.page
        .getByRole("dialog", { name: "Connect a wallet" })
        .waitFor();
      assert.ok(
        await empty.page
          .getByRole("button", { name: "Test browser wallet" })
          .isVisible(),
      );
      assert.equal(
        await empty.page
          .getByRole("button", { name: "Browser wallet", exact: true })
          .count(),
        0,
      );
      await empty.page.keyboard.press("Escape");
      assert.equal(await empty.page.getByRole("dialog").count(), 0);
      assert.equal(
        await empty.page.evaluate(() =>
          document.activeElement.textContent.trim(),
        ),
        "Connect to create",
      );
      await connect(empty.page);
      await empty.page
        .getByRole("button", { name: "Review guild creation" })
        .click();
      await empty.page
        .getByText("Choose 1–24 characters:", { exact: false })
        .waitFor();
      assert.equal(
        await empty.page.locator("#guild-name").getAttribute("aria-invalid"),
        "true",
      );
      await empty.page
        .getByLabel("Guild name", { exact: true })
        .fill("Test Crew");
      await empty.page.getByLabel("Seats", { exact: true }).fill("10");
      await empty.page
        .getByRole("button", { name: "Review guild creation" })
        .click();
      await empty.page
        .getByRole("dialog", { name: "Create this guild?" })
        .waitFor();
      assert.ok(
        (await empty.page.getByRole("dialog").innerText()).includes(
          "Only the hash",
        ),
      );
      await empty.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.equal(
        await empty.page.evaluate(
          () =>
            window.__walletCalls.filter(
              (c) => c.method === "eth_sendTransaction",
            ).length,
        ),
        0,
      );
    },
  );
  await step(
    "simulation before signing, duplicate-click prevention, friendly rejection, and successful receipt",
    async () => {
      await empty.page
        .getByRole("button", { name: "Review guild creation" })
        .click();
      const send = empty.page.getByRole("button", {
        name: "Simulate & continue",
        exact: true,
      });
      await send.click();
      await empty.page
        .getByRole("button", { name: "Waiting for wallet…" })
        .waitFor();
      assert.equal(
        await empty.page
          .getByRole("button", { name: "Waiting for wallet…" })
          .isDisabled(),
        true,
      );
      await empty.page
        .getByRole("button", { name: "Waiting for wallet…" })
        .evaluate((button) => button.click());
      await empty.page
        .getByText("You declined the wallet request.", { exact: false })
        .waitFor();
      let sends = await empty.page.evaluate(() =>
        window.__walletCalls.filter((c) => c.method === "eth_sendTransaction"),
      );
      assert.equal(sends.length, 1);
      assert.equal(sends[0].params[0].to, CONTRACT);
      assert.equal(sends[0].params[0].value, "0x0");
      assert.ok(empty.data.calls.some((c) => c.method === "eth_estimateGas"));
      const simulations = empty.data.calls
        .filter(
          (c) =>
            c.method === "eth_call" && c.params[0].from?.toLowerCase() === A,
        )
        .map((c) => decodeFunctionData({ abi: ABI, data: c.params[0].data }));
      assert.ok(simulations.some((c) => c.functionName === "createGuild"));
      await empty.page.evaluate(() => {
        window.__walletScenario = "success";
      });
      await empty.page
        .getByRole("button", { name: "Simulate & continue", exact: true })
        .click();
      await empty.page
        .getByRole("heading", { name: "Save your invite code" })
        .waitFor();
      const code = await empty.page.locator(".secret-box code").innerText();
      assert.match(code, /^MR-[A-HJ-NP-Z2-9]{6}$/);
      sends = await empty.page.evaluate(() =>
        window.__walletCalls.filter((c) => c.method === "eth_sendTransaction"),
      );
      const decoded = decodeFunctionData({
        abi: ABI,
        data: sends.at(-1).params[0].data,
      });
      assert.equal(decoded.functionName, "createGuild");
      assert.equal(decoded.args[2], keccak256(toHex(code)));
      assert.ok(
        !sends
          .at(-1)
          .params[0].data.includes(Buffer.from(code).toString("hex")),
      );
      assert.ok(
        !(
          await empty.page.evaluate(() => JSON.stringify(localStorage))
        ).includes(code),
      );
      await empty.page
        .getByRole("button", { name: "Done", exact: true })
        .click();
      assert.equal(await empty.page.locator(".secret-box").count(), 0);
      const walletMethods = await empty.page.evaluate(() =>
        window.__walletCalls.map((c) => c.method),
      );
      assert.ok(
        !walletMethods.some((method) =>
          [
            "eth_call",
            "eth_getCode",
            "eth_getLogs",
            "eth_getBalance",
            "eth_estimateGas",
            "eth_getBlockByNumber",
          ].includes(method),
        ),
      );
    },
  );
  await step(
    "a lagging RPC retries missing-block reads without mixing snapshot blocks",
    async () => {
      const lagging = await setup("lagging");
      const calls = lagging.data.calls.filter((c) => c.method === "eth_call");
      const repeated = calls.filter(
        (c) =>
          calls.filter((other) => other.params[0].data === c.params[0].data)
            .length > 1,
      );
      assert.ok(repeated.length >= 4);
      assert.equal(new Set(calls.map((c) => c.params[1])).size, 1);
      assert.ok(
        !(
          await lagging.page.locator(".read-status").getAttribute("class")
        ).includes("has-error"),
      );
    },
  );
  const populated = await setup();
  await step(
    "populated rankings sort, tier filtering, guild profiles and member data",
    async () => {
      assert.equal(await populated.page.locator("table tbody tr").count(), 2);
      assert.ok(
        (
          await populated.page.locator("table tbody tr").first().innerText()
        ).includes("Nebula Nibblers"),
      );
      await populated.page
        .getByRole("combobox", { name: "Sort guilds" })
        .selectOption("members");
      assert.ok(
        (
          await populated.page.locator("table tbody tr").first().innerText()
        ).includes("Midnight Runners"),
      );
      await populated.page
        .getByRole("combobox", { name: "Filter by tier" })
        .selectOption("3");
      await populated.page
        .getByRole("heading", { name: "No matching guilds" })
        .waitFor();
      await populated.page
        .getByRole("button", { name: "clear filters" })
        .click();
      await populated.page
        .getByRole("link", { name: /Midnight Runners/ })
        .click();
      await populated.page
        .getByRole("heading", { name: "Guild profile" })
        .waitFor();
      assert.equal(await populated.page.locator(".member-row").count(), 2);
      assert.ok(
        await populated.page
          .getByText("Staker ×1.25", { exact: true })
          .isVisible(),
      );
    },
  );
  await step(
    "GuildCreated alone includes disconnected captains in live and historical rosters",
    async () => {
      const creationLogs = populated.data.logs.filter(
        (log) =>
          decodeEventLog({ abi: ABI, ...log }).eventName === "GuildCreated",
      );
      assert.equal(creationLogs.length, 2);
      assert.equal(
        populated.data.logs.filter((log) => {
          const decoded = decodeEventLog({ abi: ABI, ...log });
          return (
            decoded.eventName === "Joined" &&
            [A, B].includes(decoded.args.wallet)
          );
        }).length,
        0,
      );
      for (const log of creationLogs)
        assert.ok(
          populated.data.calls.some(
            (call) =>
              call.method === "eth_getBlockByNumber" &&
              call.params[0] === log.blockNumber,
          ),
          "creation blocks must have timestamps for historical filtering",
        );
      assert.equal(
        await populated.page
          .getByRole("button", { name: "Connect wallet", exact: true })
          .count(),
        1,
      );
      assert.equal(await populated.page.locator(".member-row").count(), 2);
      assert.match(
        await populated.page
          .locator(".member-row")
          .filter({ hasText: A })
          .innerText(),
        /25\s+pts/,
      );
      assert.ok(
        await populated.page
          .locator(".member-row")
          .filter({ hasText: C })
          .isVisible(),
      );
      await populated.page.goto(`${url}#guild/2`);
      await populated.page
        .getByRole("heading", { name: "Guild profile" })
        .waitFor();
      assert.equal(await populated.page.locator(".member-row").count(), 1);
      assert.match(
        await populated.page
          .locator(".member-row")
          .filter({ hasText: B })
          .innerText(),
        /20\s+pts/,
      );
      await populated.page.goto(`${url}#war`);
      await populated.page.locator(".rope-flag").waitFor();
      assert.equal(await populated.page.locator(".war-member").count(), 3);
      for (const wallet of [A, B, C])
        assert.ok(
          await populated.page
            .locator(".war-member")
            .filter({ hasText: wallet })
            .isVisible(),
        );
      await populated.page
        .getByRole("combobox", { name: "War season" })
        .selectOption(String(populated.data.prior));
      await populated.page
        .getByText("Settled on Sepolia", { exact: true })
        .waitFor();
      assert.equal(await populated.page.locator(".war-member").count(), 3);
      assert.match(
        await populated.page
          .locator(".war-member")
          .filter({ hasText: A })
          .innerText(),
        /114 pts/,
      );
      assert.match(
        await populated.page
          .locator(".war-member")
          .filter({ hasText: B })
          .innerText(),
        /100 pts/,
      );
      await populated.page.goto(`${url}#guild/1`);
    },
  );
  await step(
    "daily check-in preview is exactly simulated; captain tools explain consequences",
    async () => {
      await connect(populated.page);
      await populated.page
        .getByRole("link", { name: "My guild", exact: true })
        .click();
      await populated.page
        .getByRole("button", { name: "Check in · +25 pts" })
        .waitFor();
      await populated.page
        .getByRole("button", { name: "Check in · +25 pts" })
        .click();
      await populated.page
        .getByRole("dialog", { name: "Check in for today?" })
        .waitFor();
      assert.ok(
        (await populated.page.getByRole("dialog").innerText()).includes(
          "25 season points",
        ),
      );
      await populated.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await populated.page
        .getByRole("button", { name: "Make captain", exact: true })
        .click();
      assert.ok(
        (await populated.page.getByRole("dialog").innerText()).includes(
          "give up all captain tools",
        ),
      );
      await populated.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await populated.page
        .getByRole("button", { name: "Generate new code" })
        .click();
      assert.ok(
        (await populated.page.getByRole("dialog").innerText()).includes(
          "old code stops working",
        ),
      );
      await populated.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      for (const width of [320, 390, 760, 1440])
        await noOverflow(populated.page, width);
      await populated.page.screenshot({
        path: path.join(out, "fixture-guild-1440.png"),
        fullPage: true,
      });
    },
  );
  await step(
    "war comparison, past member scores, lead bar, and actual SVG download",
    async () => {
      await populated.page
        .getByRole("link", { name: "War", exact: true })
        .click();
      await populated.page
        .getByRole("combobox", { name: "War season" })
        .selectOption(String(populated.data.prior));
      await populated.page
        .getByText("Settled on Sepolia", { exact: true })
        .waitFor();
      const downloadPromise = populated.page.waitForEvent("download");
      await populated.page
        .getByRole("button", { name: "Download share card" })
        .click();
      const download = await downloadPromise;
      const file = path.join(out, "war.svg");
      await download.saveAs(file);
      const svg = fs.readFileSync(file, "utf8");
      assert.ok(svg.includes("Midnight Runners beat Nebula Nibblers by 14%"));
      assert.ok(svg.startsWith("<svg"));
      assert.equal(await populated.page.locator(".war-member").count(), 3);
      assert.equal(
        await populated.page
          .getByRole("button", { name: "Review war submission" })
          .isDisabled(),
        true,
      );
      for (const width of [320, 390, 760, 1440])
        await noOverflow(populated.page, width);
      await populated.page.screenshot({
        path: path.join(out, "fixture-war-1440.png"),
        fullPage: true,
      });
    },
  );
  await step(
    "recruiting board, public profiles, and trophies use indexed events",
    async () => {
      await populated.page
        .getByRole("link", { name: "Recruiting", exact: true })
        .click();
      await populated.page.locator(".recruit-card").first().waitFor();
      assert.equal(await populated.page.locator(".recruit-card").count(), 2);
      await populated.page
        .getByRole("link", { name: "View profile", exact: true })
        .click();
      assert.ok(
        await populated.page
          .getByRole("link", { name: D, exact: true })
          .isVisible(),
      );
      await populated.page
        .getByRole("link", { name: "Trophies", exact: true })
        .click();
      await populated.page.locator(".podium-card").first().waitFor();
      assert.equal(await populated.page.locator(".podium-card").count(), 2);
      assert.equal(await populated.page.locator(".tier-display").count(), 4);
      assert.equal(
        await populated.page.locator(".achievers .member-row").count(),
        2,
      );
      for (const width of [320, 390, 760, 1440])
        await noOverflow(populated.page, width);
    },
  );
  await step(
    "new check-in refresh moves the rope flag and animates a pull; reduced motion stops it",
    async () => {
      await populated.page
        .getByRole("link", { name: "War", exact: true })
        .click();
      await populated.page.locator(".rope-flag").waitFor();
      const before = await populated.page
        .locator(".rope-flag")
        .getAttribute("style");
      await populated.page.emulateMedia({ reducedMotion: "no-preference" });
      populated.data.appendCheck();
      await populated.page
        .getByRole("button", { name: "Refresh chain data" })
        .click();
      await populated.page.locator(".team-a.pull").waitFor();
      const after = await populated.page
        .locator(".rope-flag")
        .getAttribute("style");
      assert.notEqual(before, after);
      assert.ok(
        await populated.page
          .locator(".team-a")
          .evaluate((el) =>
            el.getAnimations().some((a) => a.playState === "running"),
          ),
      );
      await populated.page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await populated.page
          .locator(".team-a")
          .evaluate(
            (el) =>
              el.getAnimations().filter((a) => a.playState === "running")
                .length,
          ),
        0,
      );
    },
  );
  const unsettled = await setup("unsettled");
  await step(
    "eligible past-season war offers a captain a consequence review",
    async () => {
      await connect(unsettled.page);
      await unsettled.page
        .getByRole("link", { name: "War", exact: true })
        .click();
      await unsettled.page
        .getByRole("combobox", { name: "War season" })
        .selectOption(String(unsettled.data.prior));
      const submit = unsettled.page.getByRole("button", {
        name: "Review war submission",
      });
      await submit.waitFor();
      await unsettled.page.waitForFunction(
        () =>
          ![...document.querySelectorAll("button")].find((b) =>
            b.textContent.includes("Review war submission"),
          )?.disabled,
      );
      await submit.click();
      assert.ok(
        (await unsettled.page.getByRole("dialog").innerText()).includes(
          "other captain cannot refuse",
        ),
      );
      await unsettled.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    },
  );
  const checked = await setup("checked");
  await step("already checked-in state prevents another request", async () => {
    await connect(checked.page);
    await checked.page
      .getByRole("link", { name: "My guild", exact: true })
      .click();
    await checked.page
      .getByRole("button", { name: "Checked in today", exact: true })
      .waitFor();
    assert.ok(
      await checked.page
        .getByRole("button", { name: "Checked in today", exact: true })
        .isDisabled(),
    );
    assert.ok(
      (await checked.page.locator(".checkin-panel").innerText()).includes(
        "00:00 UTC",
      ),
    );
  });
  const wrong = await setup("empty", { wrongChain: true });
  await step(
    "wrong network disables writes and offers Sepolia switching",
    async () => {
      await wrong.page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .click();
      await wrong.page
        .getByRole("button", { name: "Test browser wallet", exact: true })
        .click();
      await wrong.page
        .getByRole("button", { name: "Switch to Sepolia", exact: true })
        .waitFor();
      await wrong.page
        .getByRole("link", { name: "Create / Join", exact: true })
        .click();
      assert.ok(
        await wrong.page
          .getByRole("button", { name: "Review guild creation" })
          .isDisabled(),
      );
      await wrong.page
        .getByRole("button", { name: "Switch to Sepolia", exact: true })
        .click();
      await wrong.page
        .getByRole("button", { name: "0x1111…1111", exact: true })
        .waitFor();
      const methods = await wrong.page.evaluate(() =>
        window.__walletCalls.map((c) => c.method),
      );
      assert.ok(methods.includes("wallet_switchEthereumChain"));
    },
  );
  const full = await setup("full", { account: D });
  await step(
    "join simulation explains a full guild before sending; opt-in status has a public review",
    async () => {
      await full.page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .click();
      await full.page
        .getByRole("button", { name: "Test browser wallet", exact: true })
        .click();
      await full.page
        .getByRole("button", { name: "0x4444…4444", exact: true })
        .waitFor();
      await full.page
        .getByRole("link", { name: "Join a guild", exact: true })
        .click();
      await full.page.getByLabel("Guild ID", { exact: true }).fill("1");
      await full.page
        .getByLabel("Invite code", { exact: true })
        .fill("MR-FIXTURE");
      await full.page.getByRole("button", { name: "Review joining" }).click();
      assert.ok(
        (await full.page.getByRole("dialog").innerText()).includes(
          "visible in the join transaction",
        ),
      );
      await full.page
        .getByRole("button", { name: "Simulate & continue", exact: true })
        .click();
      await full.page
        .getByText("That guild is full.", { exact: false })
        .waitFor();
      assert.equal(
        await full.page.evaluate(
          () =>
            window.__walletCalls.filter(
              (c) => c.method === "eth_sendTransaction",
            ).length,
        ),
        0,
      );
      await full.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await full.page
        .getByRole("link", { name: "Recruiting", exact: true })
        .click();
      await full.page
        .getByRole("button", { name: "Remove my listing" })
        .click();
      assert.ok(
        (await full.page.getByRole("dialog").innerText()).includes(
          "earlier opt-in event remains public",
        ),
      );
      await full.page
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    },
  );
  await step(
    "phone without an injected provider offers all four wallet links and Coinbase Smart Wallet",
    async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      });
      contexts.push(context);
      const data = fixture("empty");
      await context.route(`${RPC}/**`, async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(await data.rpc(route.request().postDataJSON())),
        });
      });
      const page = await context.newPage();
      await page.goto(url);
      await page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .click();
      for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
        assert.ok(
          await page.getByRole("link", { name: `Open in ${name}` }).isVisible(),
        );
      assert.ok(
        await page
          .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
          .isVisible(),
      );
      const rabby = await page
        .getByRole("link", { name: "Open in Rabby" })
        .getAttribute("href");
      assert.ok(rabby.includes("_cmd=open-dapp"));
      const bounds = await page.getByRole("dialog").boundingBox();
      assert.equal(Math.round(bounds.y + bounds.height), 844);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
    },
  );
  await step(
    "RPC failure stays distinct from an empty registry and Refresh recovers",
    async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      contexts.push(context);
      await context.route(`${RPC}/**`, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(url);
      await page.getByText("Unable to read Sepolia", { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("heading", {
            name: "No guild yet. Be the first to create one.",
          })
          .count(),
        0,
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Connect wallet", exact: true })
          .isEnabled(),
      );
      assert.ok(
        (await page.locator(".read-status").innerText()).includes(
          "public Sepolia RPC is unavailable",
        ),
      );
      await context.unrouteAll();
      const data = fixture("empty");
      await context.route(`${RPC}/**`, async (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(await data.rpc(route.request().postDataJSON())),
        }),
      );
      await page.getByRole("button", { name: "Refresh chain data" }).click();
      await page
        .getByRole("heading", {
          name: "No guild yet. Be the first to create one.",
        })
        .waitFor();
    },
  );
  await step(
    "history loading and RPC errors do not assert empty wars, trophies, listings or profiles; Refresh recovers",
    async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      contexts.push(context);
      const data = fixture("empty");
      let unavailable = true;
      let release;
      const pending = new Promise((resolve) => {
        release = resolve;
      });
      await context.route(`${RPC}/**`, async (route) => {
        await pending;
        const request = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(
            unavailable
              ? {
                  jsonrpc: "2.0",
                  id: request.id,
                  error: { code: -32000, message: "RPC unavailable" },
                }
              : await data.rpc(request),
          ),
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${url}#trophies`);
      await page
        .getByText("Reading history…", { exact: true })
        .first()
        .waitFor();
      const noFalseClaims = async () => {
        assert.doesNotMatch(
          await page.locator("main").innerText(),
          /No season trophies awarded yet|\d+ recorded achievers|No settled wars yet|No open guilds yet|No wallets on the board yet|Not currently in a guild|No streak titles yet/,
        );
      };
      await noFalseClaims();
      unavailable = true;
      release();
      await page.getByText("Unable to read Sepolia", { exact: true }).waitFor();
      const failure = "History could not be loaded. Refresh to try again.";
      for (const route of ["trophies", "war", "recruiting", `profile/${A}`]) {
        await page.goto(`${url}#${route}`);
        await page.getByText(failure, { exact: true }).first().waitFor();
        await noFalseClaims();
        assert.doesNotMatch(await page.locator("main").innerText(), /Reading/);
        assert.ok(
          await page
            .getByRole("button", { name: "Refresh chain data" })
            .isEnabled(),
        );
        assert.ok(
          await page
            .getByRole("button", { name: "Refresh history" })
            .first()
            .isEnabled(),
        );
        for (const width of [320, 390, 760, 1440])
          await noOverflow(page, width);
        await page.setViewportSize({ width: 390, height: 844 });
        if (route === "trophies") {
          await page.screenshot({
            path: path.join(out, "history-error-390.png"),
            fullPage: true,
          });
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          assert.deepEqual(
            audit.violations.map((v) => v.id),
            [],
          );
        }
      }
      unavailable = false;
      await page.goto(`${url}#trophies`);
      await page.getByRole("button", { name: "Refresh history" }).click();
      await page.getByText(/Sepolia · block/).waitFor();
      assert.equal(
        await page.getByText("0 recorded achievers", { exact: true }).count(),
        3,
      );
      assert.match(
        await page.locator("main").innerText(),
        /No season trophies awarded yet/,
      );
      await page.goto(`${url}#war`);
      await page
        .getByRole("heading", { name: "No settled wars yet." })
        .waitFor();
      // A later failure must retain the last successful snapshot, not erase known history.
      unavailable = true;
      await page.getByRole("button", { name: "Refresh chain data" }).click();
      await page
        .getByText("Read interrupted · showing the last snapshot", {
          exact: true,
        })
        .waitFor();
      assert.ok(
        await page
          .getByRole("heading", { name: "No settled wars yet." })
          .isVisible(),
      );
      assert.equal(await page.getByText(failure, { exact: true }).count(), 0);
      await context.close();
    },
  );
  await step(
    "Refresh retries an uncached profile after either getter fails at the same block",
    async () => {
      const E = "0x5555555555555555555555555555555555555555";
      for (const failedGetter of ["members", "memberSeasonPoints"]) {
        const profile = await setup();
        let failing = true;
        let reads = 0;
        await profile.context.route(`${RPC}/**`, async (route) => {
          const request = route.request().postDataJSON();
          if (request.method !== "eth_call") return route.fallback();
          const call = decodeFunctionData({
            abi: ABI,
            data: request.params[0].data,
          });
          if (
            !["members", "memberSeasonPoints"].includes(call.functionName) ||
            call.args[0].toLowerCase() !== E
          )
            return route.fallback();
          reads++;
          if (!failing || call.functionName !== failedGetter)
            return route.fallback();
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: request.id,
              error: { code: -32000, message: "HTTP 503" },
            }),
          });
        });
        await profile.page.goto(`${url}#profile/${E}`);
        await profile.page.locator(".profile-panel [role=alert]").waitFor();
        assert.equal(reads, 2);
        const before = await profile.page
          .locator(".read-status > span")
          .last()
          .innerText();
        failing = false;
        await profile.page
          .getByRole("button", { name: "Refresh chain data" })
          .click();
        await profile.page.locator(".profile-stats").waitFor({ timeout: 5000 });
        assert.equal(reads, 4);
        assert.equal(
          await profile.page.locator(".profile-panel [role=alert]").count(),
          0,
        );
        assert.equal(
          await profile.page.locator(".read-status > span").last().innerText(),
          before,
        );
        await profile.context.close();
      }
    },
  );
  await step(
    "automated accessibility scan, reduced motion, local assets and console",
    async () => {
      await populated.page
        .getByRole("link", { name: "Rules", exact: true })
        .click();
      await populated.page.setViewportSize({ width: 390, height: 844 });
      for (const route of [
        "rankings",
        "create",
        "my-guild",
        "war",
        "recruiting",
        "trophies",
        "rules",
      ]) {
        await populated.page.goto(`${url}#${route}`);
        await populated.page.locator("main h1").waitFor();
        const audit = await new AxeBuilder({ page: populated.page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          audit.violations.map((v) => `${v.id}: ${v.help}`),
          [],
          `axe on ${route}`,
        );
        await noOverflow(populated.page, 320);
      }
      const running = await populated.page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      );
      assert.equal(running, 0);
      assert.deepEqual(errors, []);
    },
  );
  await step(
    "WebKit primary interaction if this host can launch it",
    async () => {
      let safari;
      try {
        safari = await webkit.launch({ headless: true });
      } catch {
        return {
          skipped: true,
          reason:
            "WebKit host libraries are unavailable; no WebKit interaction was performed.",
        };
      }
      try {
        const context = await safari.newContext({
          viewport: { width: 390, height: 844 },
        });
        const data = fixture("empty");
        await injectWallet(context);
        await context.route(`${RPC}/**`, async (route) => {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
              await data.rpc(route.request().postDataJSON()),
            ),
          });
        });
        const page = await context.newPage();
        await page.goto(url);
        await page
          .getByRole("heading", {
            name: "No guild yet. Be the first to create one.",
          })
          .waitFor();
        await page
          .getByRole("link", { name: "Create a guild", exact: true })
          .first()
          .click();
        await page.getByRole("button", { name: "Connect to create" }).click();
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
      } finally {
        await safari.close();
      }
    },
  );
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(
      { browser: "Chromium via Playwright", results, errors },
      null,
      2,
    ) + "\n",
  );
  await Promise.all(contexts.map((c) => c.close()));
  if (browser) await browser.close();
  server.close();
}
