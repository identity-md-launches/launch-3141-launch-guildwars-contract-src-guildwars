// Synthetic RPC + EIP-6963 fixtures for browser validation only.
// This module is not imported by the app or included in dist/.
import fs from "node:fs";
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  toHex,
} from "viem";

export const ABI = JSON.parse(
  fs.readFileSync(new URL("../src/abi.json", import.meta.url)),
);
export const CONTRACT = "0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30";
export const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const A = "0x1111111111111111111111111111111111111111";
export const B = "0x2222222222222222222222222222222222222222";
export const C = "0x3333333333333333333333333333333333333333";
export const D = "0x4444444444444444444444444444444444444444";
const HASH = `0x${"ab".repeat(32)}`;
const TX = `0x${"cd".repeat(32)}`;
const runtime = fs
  .readFileSync(
    new URL("../verification/guildwars-runtime.hex", import.meta.url),
    "utf8",
  )
  .trim();
const emptyBloom = `0x${"00".repeat(256)}`;
const day = Math.floor(Date.now() / 86400000);
const season = BigInt(Math.floor((day + 3) / 7));
const seasonTime = Number((season * 7n - 3n) * 86400n);
const prior = season - 1n;
const priorTime = seasonTime - 7 * 86400;

export function fixture(mode = "populated") {
  let created = false;
  let lastSimulation;
  let counter = 0;
  let tip = 12089906n;
  let laggedReads = mode === "lagging" ? 2 : 0;
  const currentPoints = new Map([
    [A, 25],
    [B, 20],
    [C, 10],
  ]);
  const checkDays = new Map([
    [A, mode === "checked" ? day : day - 1],
    [B, day - 1],
    [C, day - 1],
  ]);
  const calls = [];
  const logs = [];
  const blockTimes = new Map();
  const error = (message) => ({
    error: {
      code: 3,
      message: `execution reverted: ${message}`,
      data: `0x08c379a0${encodeAbiParameters([{ type: "string" }], [message]).slice(2)}`,
    },
  });
  function log(eventName, args, timestamp, atBlock) {
    const entry = ABI.find((e) => e.type === "event" && e.name === eventName);
    const nonindexed = entry.inputs.filter((e) => !e.indexed);
    const number = atBlock ?? (created ? tip : 12089807n + BigInt(counter));
    blockTimes.set(number, timestamp);
    logs.push({
      address: CONTRACT,
      blockNumber: toHex(number),
      blockHash: HASH,
      transactionHash: `0x${String(++counter).padStart(64, "0")}`,
      transactionIndex: "0x0",
      logIndex: created ? toHex(counter - 1) : "0x0",
      removed: false,
      topics: encodeEventTopics({ abi: ABI, eventName, args }),
      data: encodeAbiParameters(
        nonindexed,
        nonindexed.map((e) => args[e.name]),
      ),
    });
  }
  if (mode !== "empty") {
    for (const [id, captain, name, seats] of [
      [1n, A, "Midnight Runners", 10],
      [2n, B, "Nebula Nibblers", 5],
    ]) {
      log("GuildCreated", { guildId: id, captain, name, seats }, priorTime + 1);
    }
    log("Joined", { guildId: 1n, wallet: C }, priorTime + 2);
    // Six valid check-ins total 114 for each member of guild 1; four total 100 for guild 2.
    for (let i = 0; i < 6; i++) {
      const points = [25, 25, 20, 20, 12, 12][i];
      for (const wallet of [A, C])
        log(
          "CheckedIn",
          {
            guildId: 1n,
            wallet,
            season: prior,
            points: BigInt(points),
            nextRound: BigInt(i + 1),
            flags: points === 25 ? 3 : points === 20 ? 1 : 2,
            streak: wallet === C ? 30 + i : 2 + i,
          },
          priorTime + (i + 1) * 86400,
        );
      if (i < 4)
        log(
          "CheckedIn",
          {
            guildId: 2n,
            wallet: B,
            season: prior,
            points: 25n,
            nextRound: BigInt(i + 1),
            flags: 3,
            streak: i + 1,
          },
          priorTime + (i + 1) * 86400,
        );
    }
    if (mode !== "unsettled")
      log(
        "WarResult",
        {
          season: prior,
          guildA: 1n,
          guildB: 2n,
          scoreA: 114_000000n,
          scoreB: 100_000000n,
          winner: 1n,
        },
        seasonTime + 1,
      );
    log(
      "CheckedIn",
      {
        guildId: 1n,
        wallet: A,
        season,
        points: 25n,
        nextRound: 10n,
        flags: 3,
        streak: 8,
      },
      (day - 1) * 86400 + 10,
    );
    log(
      "CheckedIn",
      {
        guildId: 1n,
        wallet: C,
        season,
        points: 10n,
        nextRound: 10n,
        flags: 0,
        streak: 36,
      },
      (day - 1) * 86400 + 11,
    );
    log(
      "CheckedIn",
      {
        guildId: 2n,
        wallet: B,
        season,
        points: 20n,
        nextRound: 10n,
        flags: 1,
        streak: 1,
      },
      (day - 1) * 86400 + 12,
    );
    log("LookingForGuild", { wallet: D, looking: true }, day * 86400 + 10);
  }
  const currentBlock = () => tip;
  const block = (number = currentBlock()) => ({
    number: toHex(number),
    hash: HASH,
    parentHash: HASH,
    nonce: "0x0000000000000000",
    sha3Uncles: HASH,
    logsBloom: emptyBloom,
    transactionsRoot: HASH,
    stateRoot: HASH,
    receiptsRoot: HASH,
    miner: A,
    difficulty: "0x0",
    totalDifficulty: "0x0",
    extraData: "0x",
    size: "0x200",
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    timestamp: toHex(blockTimes.get(number) ?? Math.floor(Date.now() / 1000)),
    transactions: [],
    uncles: [],
    baseFeePerGas: "0x3b9aca00",
    mixHash: HASH,
    withdrawals: [],
    withdrawalsRoot: HASH,
  });
  async function rpc(request) {
    calls.push(request);
    const { method, params = [], id } = request;
    if (method === "eth_call" && laggedReads > 0) {
      laggedReads--;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: `block not found: ${params[1]}` },
      };
    }
    let result;
    if (method === "eth_chainId") result = "0xaa36a7";
    else if (method === "eth_blockNumber") result = toHex(currentBlock());
    else if (method === "eth_getCode") {
      if (params[0].toLowerCase() !== CONTRACT)
        throw new Error("Unexpected contract");
      result = runtime;
    } else if (method === "eth_getBlockByNumber")
      result = block(
        params[0] === "latest" ? currentBlock() : BigInt(params[0]),
      );
    else if (method === "eth_getLogs") {
      if (params[0].address.toLowerCase() !== CONTRACT)
        throw new Error("Unexpected log address");
      result = logs.filter(
        (log) =>
          BigInt(log.blockNumber) >= BigInt(params[0].fromBlock) &&
          BigInt(log.blockNumber) <= BigInt(params[0].toBlock),
      );
    } else if (method === "eth_estimateGas") result = "0x186a0";
    else if (method === "eth_call") {
      if (params[0].to.toLowerCase() !== CONTRACT)
        throw new Error("Unexpected read address");
      const { functionName, args = [] } = decodeFunctionData({
        abi: ABI,
        data: params[0].data,
      });
      const encoded = (value) =>
        encodeFunctionResult({ abi: ABI, functionName, result: value });
      const empty = mode === "empty" && !created;
      if (functionName === "guildCount")
        result = encoded(empty ? 0n : created ? 1n : 2n);
      else if (functionName === "currentSeason") result = encoded(season);
      else if (functionName === "minStakerPower") result = encoded(10n ** 18n);
      else if (functionName === "getGuild")
        result = encoded(
          args[0] === 1n
            ? [
                A,
                created ? "Test Crew" : "Midnight Runners",
                10,
                true,
                created ? 1 : 2,
                300,
                0,
                day - 1,
              ]
            : [B, "Nebula Nibblers", 5, true, 1, 0, 0, day - 1],
        );
      else if (functionName === "seasonScore")
        result = encoded(
          args[1] === prior
            ? args[0] === 1n
              ? [228n, 2, 114_000000n]
              : [100n, 1, 100_000000n]
            : args[0] === 1n
              ? [
                  BigInt(currentPoints.get(A) + currentPoints.get(C)),
                  2,
                  BigInt(currentPoints.get(A) + currentPoints.get(C)) * 500000n,
                ]
              : [20n, 1, 20_000000n],
        );
      else if (functionName === "guildSeasonTier") result = encoded(0);
      else if (functionName === "warDone")
        result = encoded(mode !== "unsettled" && args[0] === prior);
      else if (functionName === "members") {
        const account = args[0].toLowerCase();
        const guild = empty
          ? 0n
          : created
            ? account === A
              ? 1n
              : 0n
            : account === A || account === C
              ? 1n
              : account === B
                ? 2n
                : 0n;
        result = encoded([
          guild,
          day - 20,
          guild ? (checkDays.get(account) ?? 0) : 0,
          account === C ? 36 : 8,
          10n,
          true,
          account === D,
          mode === "cooldown" && account === A
            ? BigInt(Math.floor(Date.now() / 1000) + 3600)
            : 0n,
        ]);
      } else if (functionName === "memberSeasonPoints")
        result = encoded(
          empty ? 0 : (currentPoints.get(args[0].toLowerCase()) ?? 0),
        );
      else {
        lastSimulation = { name: functionName, args };
        if (mode === "full" && functionName === "join")
          return { jsonrpc: "2.0", id, ...error("guild full") };
        if (mode === "checked" && functionName === "checkIn")
          return { jsonrpc: "2.0", id, ...error("already checked in today") };
        result =
          functionName === "checkIn"
            ? encoded(25n)
            : functionName === "createGuild"
              ? encoded(1n)
              : "0x";
      }
    } else if (method === "eth_getTransactionReceipt") {
      if (lastSimulation?.name === "createGuild" && !created) {
        created = true;
        tip++;
        log(
          "GuildCreated",
          { guildId: 1n, captain: A, name: "Test Crew", seats: 10 },
          Math.floor(Date.now() / 1000),
        );
      }
      result = {
        transactionHash: TX,
        transactionIndex: "0x0",
        blockHash: HASH,
        blockNumber: toHex(currentBlock()),
        from: A,
        to: CONTRACT,
        cumulativeGasUsed: "0x186a0",
        gasUsed: "0x186a0",
        contractAddress: null,
        logs: [],
        logsBloom: emptyBloom,
        status: "0x1",
        effectiveGasPrice: "0x3b9aca00",
        type: "0x2",
      };
    } else throw new Error(`Unhandled fixture RPC method: ${method}`);
    return { jsonrpc: "2.0", id, result };
  }
  return {
    rpc,
    calls,
    logs,
    season,
    prior,
    appendCheck() {
      tip++;
      currentPoints.set(A, currentPoints.get(A) + 25);
      checkDays.set(A, day);
      log(
        "CheckedIn",
        {
          guildId: 1n,
          wallet: A,
          season,
          points: 25n,
          nextRound: 11n,
          flags: 3,
          streak: 9,
        },
        Math.floor(Date.now() / 1000),
        tip,
      );
    },
    get lastSimulation() {
      return lastSimulation;
    },
  };
}

export async function injectWallet(
  context,
  { wrongChain = false, account = A, scenario = "reject" } = {},
) {
  await context.addInitScript(
    ({ account, wrongChain, scenario }) => {
      let authorized = false;
      let chain = wrongChain ? "0x1" : "0xaa36a7";
      const listeners = {};
      window.__walletCalls = [];
      window.__walletScenario = scenario;
      const provider = {
        on(name, fn) {
          (listeners[name] ??= []).push(fn);
        },
        removeListener(name, fn) {
          listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn);
        },
        async request({ method, params }) {
          window.__walletCalls.push({ method, params });
          if (method === "eth_accounts") return authorized ? [account] : [];
          if (method === "eth_requestAccounts") {
            authorized = true;
            return [account];
          }
          if (method === "eth_chainId") return chain;
          if (
            method === "wallet_switchEthereumChain" ||
            method === "wallet_addEthereumChain"
          ) {
            chain = "0xaa36a7";
            (listeners.chainChanged ?? []).forEach((fn) => fn(chain));
            return null;
          }
          if (
            method === "wallet_requestPermissions" ||
            method === "wallet_getPermissions"
          )
            return [{ parentCapability: "eth_accounts", caveats: [] }];
          if (method === "wallet_getCapabilities") return {};
          if (method === "eth_sendTransaction") {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (window.__walletScenario === "reject") {
              const e = new Error("User rejected request");
              e.code = 4001;
              throw e;
            }
            return `0x${"cd".repeat(32)}`;
          }
          const e = new Error(`Unsupported wallet method ${method}`);
          e.code = 4200;
          throw e;
        },
      };
      window.ethereum = provider;
      const info = {
        uuid: "a319b7b2-9973-43b5-b4f4-331ed80c25b2",
        name: "Test browser wallet",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="purple"/></svg>',
        rdns: "test.squeek.fixture",
      };
      const announce = () =>
        dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: Object.freeze({ info, provider }),
          }),
        );
      addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { account, wrongChain, scenario },
  );
}
