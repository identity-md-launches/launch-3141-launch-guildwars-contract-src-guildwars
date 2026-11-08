import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiParameters,
  keccak256,
  toHex,
} from "viem";
import { abi, CONTRACT, friendlyError, transactionData } from "../src/chain";
import {
  decodeLogs,
  historicalMembers,
  podiums,
  replay,
  seasonAt,
  seasonStart,
  score,
  titleFor,
  type GameEvent,
} from "../src/model";
import {
  escapeXml,
  hamsterMarkup,
  hamsterTraits,
  shareText,
  shareCard,
} from "../src/art";
import { inviteCode } from "../src/CreateJoin";

// Fixtures are isolated test data. They are never imported by the production entry point.
const walletA = "0x1111111111111111111111111111111111111111";
const walletB = "0x2222222222222222222222222222222222222222";
let index = 0;
function event(name: string, args: Record<string, unknown>): GameEvent {
  return {
    name,
    args,
    block: 12089806n + BigInt(index),
    index: index++,
    tx: `fixture-${index}`,
  };
}

test("seasons switch at Monday 00:00 UTC and keep Sunday in the old season", () => {
  const monday = Date.parse("2026-11-09T00:00:00Z") / 1000;
  assert.equal(seasonAt(monday - 1) + 1n, seasonAt(monday));
  assert.equal(seasonStart(seasonAt(monday)), monday * 1000);
  assert.equal(seasonAt(monday + 6 * 86400), seasonAt(monday));
});
test("log decoding preserves indexed wallet, guild, bonus flags and streak", () => {
  const topics = encodeEventTopics({
    abi,
    eventName: "CheckedIn",
    args: { guildId: 1n, wallet: walletA },
  });
  const data = encodeAbiParameters(
    parseAbiParameters("uint256, uint256, uint64, uint8, uint32"),
    [3000n, 25n, 7n, 3, 30],
  );
  const [decoded] = decodeLogs([
    {
      address: CONTRACT,
      topics,
      data,
      blockNumber: 12089807n,
      logIndex: 0,
      transactionHash: `0x${"ab".repeat(32)}`,
      blockHash: `0x${"cd".repeat(32)}`,
      transactionIndex: 0,
      removed: false,
    },
  ]);
  assert.equal(decoded.name, "CheckedIn");
  assert.equal(decoded.args.wallet, walletA);
  assert.equal(decoded.args.flags, 3);
  assert.equal(decoded.args.streak, 30);
});
test("replay reconstructs members, removes departed members, and honors latest opt-in", () => {
  const events = [
    event("Joined", { guildId: 1n, wallet: walletA }),
    event("GuildCreated", { guildId: 1n, captain: walletA }),
    event("Joined", { guildId: 1n, wallet: walletB }),
    event("LookingForGuild", { wallet: walletB, looking: true }),
    event("Left", { guildId: 1n, wallet: walletB }),
    event("LookingForGuild", { wallet: walletB, looking: false }),
  ];
  const state = replay(events);
  assert.equal(state.guildIds.size, 1);
  assert.equal(state.roster.size, 1);
  assert.equal(state.roster.get(walletA), 1n);
  assert.equal(state.looking.size, 0);
  const removed = replay([
    ...events,
    event("Kicked", { guildId: 1n, wallet: walletA }),
  ]);
  assert.equal(removed.roster.size, 0);
});
test("historic rosters freeze at the season boundary and departure removes season points", () => {
  const season = 2966n;
  const start = seasonStart(season) / 1000;
  const events = [
    event("Joined", { guildId: 1n, wallet: walletA, _timestamp: start }),
    event("CheckedIn", { guildId: 1n, wallet: walletA, season, points: 20n }),
    event("Joined", { guildId: 1n, wallet: walletB, _timestamp: start }),
    event("CheckedIn", { guildId: 1n, wallet: walletB, season, points: 25n }),
    event("Left", { guildId: 1n, wallet: walletB, _timestamp: start + 100 }),
    event("Joined", {
      guildId: 2n,
      wallet: walletB,
      _timestamp: start + 86401,
    }),
    event("CheckedIn", { guildId: 2n, wallet: walletB, season, points: 10n }),
    event("Left", {
      guildId: 1n,
      wallet: walletA,
      _timestamp: start + 7 * 86400,
    }),
  ];
  assert.deepEqual(historicalMembers(events, 1n, season), [
    { address: walletA, points: 20 },
  ]);
  assert.deepEqual(historicalMembers(events, 2n, season), [
    { address: walletB, points: 10 },
  ]);
});
test("podiums use only actual WarResult scores, order ties deterministically, and do not invent third place", () => {
  const wars = [
    {
      season: 10n,
      a: 2n,
      b: 1n,
      scoreA: 14_000000n,
      scoreB: 14_000000n,
      winner: 0n,
      tx: "fixture",
    },
  ];
  assert.deepEqual(
    podiums(wars, 10n).map((p) => p.id),
    [1n, 2n],
  );
  assert.equal(podiums(wars, 9n).length, 0);
});
test("hamsters are deterministic and expose all required visual variants", () => {
  assert.equal(hamsterMarkup(1n, "Alpha"), hamsterMarkup(1n, "Alpha"));
  assert.notEqual(hamsterMarkup(1n, "Alpha"), hamsterMarkup(2n, "Alpha"));
  const traits = Array.from({ length: 256 }, (_, id) =>
    hamsterTraits(BigInt(id), "Fixture guild"),
  );
  assert.equal(new Set(traits.map((t) => t.palette)).size, 8);
  assert.equal(new Set(traits.map((t) => t.eyes)).size, 3);
  assert.equal(new Set(traits.map((t) => t.accessory)).size, 5);
  assert.ok(
    !hamsterMarkup(1n, "<script>alert(1)</script>").includes("<script>"),
  );
});
test("invite codes use browser cryptography, have the expected alphabet, and hash into bytes32", () => {
  const codes = Array.from({ length: 100 }, inviteCode);
  assert.equal(new Set(codes).size, 100);
  codes.forEach((code) => {
    assert.match(code, /^MR-[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(keccak256(toHex(code)).length, 66);
  });
});
test("share copy handles percentages, ties, zero scores and XML escaping", () => {
  assert.equal(
    shareText("A", "B", 114_000000n, 100_000000n),
    "A beat B by 14%",
  );
  assert.equal(shareText("A", "B", 0n, 0n), "A tied B");
  assert.equal(
    shareText("A", "B", 0n, 10_000000n),
    "B beat A by 10 points/member",
  );
  assert.equal(escapeXml("<A&B>"), "&lt;A&amp;B&gt;");
});
test("streak title thresholds are exact", () => {
  assert.equal(titleFor(6), undefined);
  assert.equal(titleFor(7), "Week warrior");
  assert.equal(titleFor(30), "Unstoppable paws");
  assert.equal(titleFor(100), "Century squeeker");
});
test("nearby guild averages remain distinct and a small lead never displays as zero", () => {
  const a = 113_000000n / 19n;
  const b = 119_000000n / 20n;
  assert.notEqual(score(a), score(b));
  assert.equal(score(b - a), "0.003");
});
test("share-card lines preserve guild names containing the word by", () => {
  const card = shareCard(
    { id: 1n, name: "Stand by Me" },
    { id: 2n, name: "Play by Play" },
    114_000000n,
    100_000000n,
    2966n,
    true,
  );
  assert.ok(card.includes(">Stand by Me beat Play by Play</text>"));
  assert.ok(card.includes(">by 14%</text>"));
});
test("primary write calls encode against the source-derived ABI", () => {
  const writes: [string, unknown[]][] = [
    ["createGuild", ["Alpha", 5, keccak256(toHex("test"))]],
    ["join", [1n, "test"]],
    ["leave", []],
    ["kick", [walletB]],
    ["removeInactive", [walletB]],
    ["transferCaptain", [walletB]],
    ["claimCaptain", []],
    ["setRecruiting", [true]],
    ["setInviteCode", [keccak256(toHex("test"))]],
    ["setLookingForGuild", [true]],
    ["checkIn", []],
    ["submitWar", [2965n, 1n, 2n]],
  ];
  for (const [name, args] of writes)
    assert.match(transactionData(name, args), /^0x[0-9a-f]+$/);
});
test("errors explain rejection, pending requests, full guilds, codes, daily limits and cooldown", () => {
  assert.ok(friendlyError({ code: 4001 }).includes("declined"));
  assert.ok(friendlyError({ code: -32002 }).includes("already open"));
  for (const [message, expected] of [
    ["User rejected request", "declined"],
    ["Request already pending", "already open"],
    ["guild full", "full"],
    ["wrong code", "did not match"],
    ["already checked in today", "00:00 UTC"],
    ["cool-down", "24-hour"],
  ])
    assert.ok(friendlyError(new Error(message)).includes(expected));
});
