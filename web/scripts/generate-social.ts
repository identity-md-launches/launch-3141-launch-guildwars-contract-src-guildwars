import { chromium } from "playwright";
import fs from "node:fs";
import { hamsterMarkup } from "../src/art";

const font = fs
  .readFileSync(
    new URL("../src/assets/fonts/doto-latin-900-normal.woff2", import.meta.url),
  )
  .toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#232334"/></pattern><style>@font-face{font-family:Doto;src:url(data:font/woff2;base64,${font});font-weight:900}</style></defs><rect width="1200" height="630" fill="#07070b"/><rect width="1200" height="630" fill="url(#dots)"/><text x="64" y="87" fill="#c9a5ff" font-family="monospace" font-size="24" letter-spacing="3">SQUEEK GUILD WARS</text><text x="64" y="235" fill="#ecebf5" font-family="Doto,monospace" font-weight="900" font-size="66">Small paws.</text><text x="64" y="320" fill="#c9a5ff" font-family="Doto,monospace" font-weight="900" font-size="66">Big rivalries.</text><text x="67" y="385" fill="#8a8aa3" font-family="monospace" font-size="20">A daily team game for the</text><text x="67" y="418" fill="#8a8aa3" font-family="monospace" font-size="20">Squeekchain community.</text><g transform="translate(675 140) scale(1.4)">${hamsterMarkup("welcome", "Future guild")}</g><g transform="translate(950 220) scale(1.15)">${hamsterMarkup("rivalry", "Future rival")}</g><path d="M840 330h200" stroke="#9e86b9" stroke-width="6"/><path d="M940 330v-65l33 16-33 16Z" fill="#a259ff"/><path d="M65 513h1070" stroke="#232334"/><text x="65" y="565" fill="#8a8aa3" font-family="monospace" font-size="20">Unofficial community project; no tokens, no payouts.</text></svg>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: new URL("../public/share.png", import.meta.url).pathname,
  });
  console.log(
    "Generated web/public/share.png (1200 × 630) from local artwork and font.",
  );
} finally {
  await browser.close();
}
