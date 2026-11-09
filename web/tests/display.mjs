// Optional DOM validation for machines without a native browser. This does not measure layout.
// npm install --prefix test/scratch/site --no-save happy-dom (in a scratch copy of web/).
// Run from that copy: node tests/display.mjs. No test fixture enters the production bundle.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Window } from "happy-dom";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.join(root, "test/scratch/display");
fs.mkdirSync(out, { recursive: true });
const src = fileURLToPath(new URL("../src/", import.meta.url));
const state = {
  snapshot: {},
  listeners: new Set(),
  account: {},
  actions: [],
  busy: false,
  scores: new Map(),
  walletOpened: false,
};
globalThis.__display = state;
const win = new Window({ url: "http://localhost/preview/" });
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Event",
  "CustomEvent",
  "MutationObserver",
])
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === "window" ? win : win[name],
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = {
  store: `import {useSyncExternalStore} from 'react';
    const s=globalThis.__display;
    export const useGame=()=>useSyncExternalStore((fn)=>{s.listeners.add(fn);return ()=>s.listeners.delete(fn)},()=>s.snapshot);
    export const refresh=async()=>{};
    export const readMember=async(address)=>s.snapshot.people.find(p=>p.address===address);`,
  Transactions: `export const useTransaction=()=>({act:(action)=>globalThis.__display.actions.push(action),busy:globalThis.__display.busy});`,
  Wallet: `export const openWallet=()=>{globalThis.__display.walletOpened=true};`,
  chain: `export {default as abi} from './abi.json';
    export const CHAIN_ID=11155111, CONTRACT='0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30', EXPLORER='https://sepolia.etherscan.io', READ_RPC='https://ethereum-sepolia-rpc.publicnode.com';
    export const friendlyError=(e)=>String(e);
    export const simulate=async()=>25;
    export const read=async(name,args)=>name==='seasonScore'?globalThis.__display.scores.get(args.join(':')):name==='warDone'?false:0;`,
  wagmi: `export const useAccount=()=>globalThis.__display.account;`,
};
await build({
  stdin: {
    contents: `export {Rankings} from './Rankings'; export {CreateJoin} from './CreateJoin'; export {MyGuild} from './MyGuild'; export {WarPage} from './War'; export {Recruiting,Trophies,Profile} from './Community'; export {Rules} from './Rules';`,
    resolveDir: src,
    loader: "tsx",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  outfile: path.join(out, "components.mjs"),
  packages: "external",
  plugins: [
    {
      name: "display-hooks",
      setup(builder) {
        builder.onResolve(
          { filter: /^(wagmi|\.\/(store|Transactions|Wallet|chain))$/ },
          (args) => ({
            path: args.path.replace("./", ""),
            namespace: "display-mock",
          }),
        );
        builder.onLoad({ filter: /.*/, namespace: "display-mock" }, (args) => ({
          contents: mocks[args.path],
          resolveDir: src,
          loader: "js",
        }));
        builder.onResolve({ filter: /^(react(?:\/.*)?|viem)$/ }, (args) => ({
          path: import.meta.resolve(args.path),
          external: true,
        }));
      },
    },
  ],
});
// Keep React external and use the same installed instance in both the harness and components.
const { createElement: h, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const components = await import(
  pathToFileURL(path.join(out, "components.mjs")).href
);
const host = document.createElement("div");
document.body.append(host);
const reactRoot = createRoot(host);
const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";
const now = Math.floor(Date.now() / 1000);
const season = BigInt(Math.floor((Math.floor(now / 86400) + 3) / 7));
const start = Number((season * 7n - 3n) * 86400n);
function guild(id, name, count, seasonMembers = count, average = 20_000000n) {
  return {
    id,
    name,
    captain: id === 1n ? A : B,
    seats: 10,
    recruiting: true,
    memberCount: count,
    seasonMembers,
    average,
    total: 100n,
    tier: 0,
    tierPoints: 0,
    captainActiveDay: Math.floor(now / 86400),
  };
}
let eventIndex = 0;
function event(name, guildId, wallet, timestamp, extra = {}) {
  return {
    name,
    args: { guildId, wallet, _timestamp: timestamp, ...extra },
    block: 12089806n + BigInt(eventIndex),
    index: eventIndex++,
    tx: `test-event-${eventIndex}`,
  };
}
function setGame(guilds, events = [], people = []) {
  state.snapshot = {
    status: "ready",
    refreshing: false,
    guilds,
    events,
    people,
    season,
    block: 12096958n,
    timestamp: now,
    updatedAt: Date.now(),
    verified: true,
    minPower: 10n ** 18n,
    indexed: { wars: [] },
    newChecks: [],
    progress: "",
  };
  state.scores.clear();
  for (const g of guilds)
    state.scores.set(`${g.id}:${season}`, [
      g.total,
      g.seasonMembers,
      g.average,
    ]);
}
async function render(name, props = {}) {
  await act(async () =>
    reactRoot.render(
      h(components[name], { ...props, key: `${name}-${++eventIndex}` }),
    ),
  );
}
async function input(element, value) {
  await act(async () => {
    const proto =
      element.tagName === "SELECT"
        ? win.HTMLSelectElement.prototype
        : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function click(element) {
  assert.ok(element);
  await act(async () => element.click());
}
async function submit() {
  await act(async () =>
    host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
const findButton = (text) =>
  [...host.querySelectorAll("button")].find(
    (el) => el.textContent.trim() === text,
  );
const text = () => host.textContent;
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
try {
  for (const guilds of [[], [guild(1n, "Golden Squeek", 1)]]) {
    await check(
      `${guilds.length} guilds: Rankings, War and Create render honest states`,
      async () => {
        setGame(guilds);
        await render("Rankings");
        assert.equal(host.querySelectorAll("tbody tr").length, guilds.length);
        assert.ok(!host.querySelector("input[type=checkbox]").checked);
        if (guilds.length) assert.match(text(), /Golden Squeek #1/);
        else assert.match(text(), /No guild yet/);
        await render("WarPage");
        assert.match(text(), /A rivalry needs two guilds/);
        assert.ok(findButton("Review war submission").disabled);
        assert.equal(
          host.querySelectorAll('select[aria-label="First guild"] option')
            .length,
          1,
        );
        if (guilds.length)
          assert.match(text(), /20 points \/ member · 1 season members/);
        await render("CreateJoin");
        assert.ok(host.querySelector("#guild-name"));
        assert.ok(host.querySelector("input#guild-seats"));
      },
    );
  }
  await check(
    "Rankings keeps IDs, members/seats, small-sample context, season filter and both sorts",
    async () => {
      setGame([
        guild(1n, "Golden Squeek", 6, 4, 30_000000n),
        guild(2n, "Golden Squeek", 5, 5, 20_000000n),
      ]);
      await render("Rankings");
      const rows = host.querySelectorAll("tbody tr");
      assert.match(rows[0].textContent, /Golden Squeek #1/);
      assert.match(rows[0].querySelector(".crew-col").textContent, /6 \/ 10/);
      assert.equal(host.querySelectorAll(".small-sample").length, 1);
      const toggle = host.querySelector("input[type=checkbox]");
      await click(toggle);
      assert.equal(host.querySelectorAll("tbody tr").length, 1);
      assert.match(host.querySelector("tbody").textContent, /Golden Squeek #2/);
      await input(
        host.querySelector('select[aria-label="Filter by tier"]'),
        "3",
      );
      assert.match(text(), /No matching guilds/);
      await click(findButton("clear filters"));
      assert.equal(host.querySelectorAll("tbody tr").length, 2);
      assert.ok(!toggle.checked);
      await input(
        host.querySelector('select[aria-label="Sort guilds"]'),
        "members",
      );
      assert.match(host.querySelector("tbody tr").textContent, /#1/);
      assert.match(
        text(),
        /Averages favour small crews: check the member count before comparing guilds\./,
      );
    },
  );
  await check(
    "Duplicate names warn inline and in review, normalize case/spaces, and never block creating",
    async () => {
      setGame(
        [guild(1n, "Golden Squeek", 1)],
        [
          event("GuildCreated", 1n, A, start, {
            name: "Golden Squeek",
            captain: A,
          }),
          event("GuildCreated", 3n, B, start, {
            name: "golden  SQUEEK",
            captain: B,
          }),
        ],
      );
      state.account = { address: C, chainId: 11155111 };
      state.actions = [];
      await render("CreateJoin");
      await input(host.querySelector("#guild-name"), "  GOLDEN   squeek ");
      assert.match(
        host.querySelector("#name-warning").textContent,
        /already exists \(#1, #3\)/,
      );
      assert.ok(!findButton("Review guild creation").disabled);
      await submit();
      assert.equal(state.actions.at(-1).name, "createGuild");
      assert.match(
        state.actions.at(-1).explanation,
        /Players will tell yours apart by its ID/,
      );
      await input(host.querySelector("#guild-name"), "Different Crew");
      assert.equal(host.querySelector("#name-warning").textContent, "");
      await submit();
      assert.equal(state.actions.at(-1).args[0], "Different Crew");
      state.busy = true;
      await render("CreateJoin");
      assert.ok(findButton("Review guild creation").disabled);
      state.busy = false;
    },
  );
  const changes = [
    event("GuildCreated", 1n, A, start - 604800, {
      name: "Golden Squeek",
      captain: A,
    }),
    event("GuildCreated", 2n, B, start - 604800, {
      name: "Golden Squeek",
      captain: B,
    }),
    event("Kicked", 1n, C, start - 1),
    event("Joined", 1n, C, start),
    event("Kicked", 1n, C, start + 1),
    event("Left", 1n, B, start + 2),
    event("Kicked", 2n, A, start + 3),
    event("Joined", 1n, C, start + 4),
  ];
  await check(
    "War shows each season count and ID, warns at a gap of 3, counts only season departures",
    async () => {
      setGame(
        [guild(1n, "Golden Squeek", 5, 5), guild(2n, "Golden Squeek", 2, 2)],
        changes,
      );
      await render("WarPage");
      assert.match(
        text(),
        /Different crew sizes: the average does not show effort/,
      );
      const counts = [...host.querySelectorAll(".war-picker-context")].map(
        (e) => e.textContent,
      );
      assert.match(counts[0], /5 season members/);
      assert.match(counts[1], /2 season members/);
      assert.deepEqual(
        [...host.querySelectorAll(".roster-changes")].map((e) =>
          e.textContent.trim(),
        ),
        [
          "Roster changed this season: 2 members left or were removed",
          "Roster changed this season: 1 members left or were removed",
        ],
      );
      assert.match(
        host.querySelector(".war-scoreboard").textContent,
        /Golden Squeek #1/,
      );
      assert.match(
        host.querySelector(".war-scoreboard").textContent,
        /Golden Squeek #2/,
      );
      assert.match(
        text(),
        /Captains pick their opponent inside the same tier\. Wars are cosmetic\./,
      );
      state.scores.set(`2:${season}`, [100n, 3, 20_000000n]);
      await render("WarPage");
      assert.ok(!text().includes("Different crew sizes:"));
      state.scores.set(`1:${season - 1n}`, [100n, 2, 10_000000n]);
      state.scores.set(`2:${season - 1n}`, [100n, 2, 10_000000n]);
      state.snapshot.indexed.wars = [
        {
          season: season - 1n,
          a: 1n,
          b: 2n,
          scoreA: 10_000000n,
          scoreB: 10_000000n,
          winner: 0n,
          tx: "fixture",
        },
      ];
      state.snapshot.events.push(
        event("WarResult", 1n, A, start, { season: season - 1n }),
      );
      await render("WarPage");
      await input(
        host.querySelector('select[aria-label="War season"]'),
        String(season - 1n),
      );
      assert.match(
        host.querySelector(".roster-changes").textContent,
        /1 members left/,
      );
      assert.ok(!text().includes("Different crew sizes:"));
      assert.match(
        host.querySelector(".war-scoreboard").textContent,
        /2 members/,
      );
    },
  );
  await check(
    "My guild removal review explains score and rejoining; recent changes expose wallet and real UTC block time",
    async () => {
      const people = [A, C].map((address) => ({
        address,
        guildId: 1n,
        points: 10,
        joinedDay: Math.floor(now / 86400),
        lastCheckInDay: Math.floor(now / 86400),
        streak: 1,
        cooldownUntil: 0n,
      }));
      setGame([guild(1n, "Golden Squeek", 2)], changes, people);
      state.account = { address: A, chainId: 11155111 };
      state.actions = [];
      await render("MyGuild");
      assert.match(text(), /Golden Squeek #1/);
      await click(findButton("Remove"));
      const action = state.actions.at(-1);
      assert.equal(action.name, "kick");
      assert.deepEqual(action.args, [C]);
      assert.match(
        action.explanation,
        /Removing a member also removes their points from this season's guild score\. The member can join again with the invite code\./,
      );
      const recent = host.querySelector(".recent-changes-list");
      assert.equal(recent.querySelectorAll("li").length, 2);
      assert.match(recent.textContent, new RegExp(C));
      assert.equal(
        recent.querySelector("time").dateTime,
        new Date((start + 1) * 1000).toISOString(),
      );
      assert.match(recent.querySelector("time").textContent, /UTC$/);
    },
  );
  await check(
    "Recruiting, trophies and profiles retain copied names with IDs; Rules lists all known limits",
    async () => {
      state.snapshot.indexed.wars = [
        {
          season: season - 1n,
          a: 1n,
          b: 2n,
          scoreA: 10_000000n,
          scoreB: 9_000000n,
          winner: 1n,
          tx: "fixture",
        },
      ];
      state.snapshot.guilds.push(guild(2n, "Golden Squeek", 1));
      await render("Recruiting");
      assert.match(
        host.querySelector(".recruit-grid").textContent,
        /Golden Squeek #1/,
      );
      assert.match(
        host.querySelector(".recruit-grid").textContent,
        /Golden Squeek #2/,
      );
      await render("Trophies");
      assert.deepEqual(
        [...host.querySelectorAll(".podium-card h3")].map((e) => e.textContent),
        ["Golden Squeek #1", "Golden Squeek #2"],
      );
      await render("Profile", { wallet: A });
      assert.match(text(), /Golden Squeek #1/);
      await render("Rules");
      assert.equal(host.querySelectorAll(".known-limits li").length, 4);
      assert.match(
        text(),
        /Unofficial community project; no tokens, no payouts\./,
      );
    },
  );
  console.log(
    `${checks.length} DOM interaction checks passed; no native rendering or layout measurement.`,
  );
} catch (error) {
  checks.push({ passed: false, error: error.message });
  process.exitCode = 1;
  console.error(error.stack);
} finally {
  await act(async () => reactRoot.unmount());
  win.happyDOM.abort();
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        kind: "DOM interaction checks; hook substitutes, no layout engine",
        checks,
      },
      null,
      2,
    ) + "\n",
  );
}
