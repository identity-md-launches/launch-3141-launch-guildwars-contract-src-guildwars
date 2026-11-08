import { useSyncExternalStore } from "react";
import type { Address } from "viem";
import {
  CONTRACT,
  START_BLOCK,
  friendlyError,
  publicClient,
  read,
  retryMissingBlock,
  verifyDeployment,
} from "./chain";
import {
  decodeLogs,
  lower,
  mapLimit,
  replay,
  type GameEvent,
  type Guild,
  type Member,
  type Replay,
} from "./model";

export type Snapshot = {
  status: "loading" | "ready" | "error";
  refreshing: boolean;
  error?: string;
  guilds: Guild[];
  people: Member[];
  season?: bigint;
  minPower?: bigint;
  block?: bigint;
  timestamp?: number;
  updatedAt?: number;
  verified: boolean;
  events: GameEvent[];
  indexed: Replay;
  newChecks: GameEvent[];
  progress: string;
};
let snapshot: Snapshot = {
  status: "loading",
  refreshing: false,
  guilds: [],
  people: [],
  events: [],
  indexed: replay([]),
  newChecks: [],
  verified: false,
  progress: "Connecting to Sepolia…",
};
const listeners = new Set<() => void>();
const notify = (next: Snapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};
let inFlight: Promise<void> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let connected: Address | undefined;
const timestamps = new Map<bigint, number>();
export const getSnapshot = () => snapshot;
export const useGame = () =>
  useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getSnapshot);

export async function readMember(
  address: Address,
  season: bigint,
  blockNumber?: bigint,
): Promise<Member> {
  const [raw, pts] = await Promise.all([
    read("members", [address], blockNumber),
    read("memberSeasonPoints", [address, season], blockNumber),
  ]);
  const m = raw as [
    bigint,
    number,
    number,
    number,
    bigint,
    boolean,
    boolean,
    bigint,
  ];
  return {
    address,
    guildId: m[0],
    joinedDay: m[1],
    lastCheckInDay: m[2],
    streak: m[3],
    lastRound: m[4],
    roundKnown: m[5],
    looking: m[6],
    cooldownUntil: m[7],
    points: Number(pts),
  };
}

async function fetchRange(
  fromBlock: bigint,
  toBlock: bigint,
): Promise<GameEvent[]> {
  try {
    return decodeLogs(
      await retryMissingBlock(() =>
        publicClient.getLogs({ address: CONTRACT, fromBlock, toBlock }),
      ),
    );
  } catch (error) {
    if (toBlock - fromBlock < 100n) throw error;
    const mid = (fromBlock + toBlock) / 2n;
    return [
      ...(await fetchRange(fromBlock, mid)),
      ...(await fetchRange(mid + 1n, toBlock)),
    ];
  }
}

export function refresh(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    notify({ ...snapshot, refreshing: true, error: undefined });
    try {
      const block = await publicClient.getBlock();
      await verifyDeployment(block.number);
      const [season, count, minPower] = await Promise.all([
        read("currentSeason", [], block.number),
        read("guildCount", [], block.number),
        read("minStakerPower", [], block.number),
      ]);
      const from =
        snapshot.block && snapshot.block > START_BLOCK + 12n
          ? snapshot.block - 12n
          : START_BLOCK;
      let collected: GameEvent[] = [];
      for (let start = from; start <= block.number; start += 4000n) {
        const end = start + 3999n > block.number ? block.number : start + 3999n;
        notify({
          ...snapshot,
          progress: `Reading events: ${start.toLocaleString()}–${end.toLocaleString()}`,
        });
        collected.push(...(await fetchRange(start, end)));
      }
      const events = [
        ...snapshot.events.filter((e) => e.block < from),
        ...collected,
      ].sort((a, b) =>
        a.block === b.block ? a.index - b.index : a.block < b.block ? -1 : 1,
      );
      // Recheck timestamps in the reorg overlap; a block at the same height can change.
      for (const number of timestamps.keys())
        if (number >= from) timestamps.delete(number);
      const blocks = [
        ...new Set(
          events
            .filter((e) =>
              ["GuildCreated", "Joined", "Left", "Kicked"].includes(e.name),
            )
            .map((e) => e.block),
        ),
      ];
      await mapLimit(
        blocks.filter((n) => !timestamps.has(n)),
        async (n) => {
          timestamps.set(
            n,
            Number((await publicClient.getBlock({ blockNumber: n })).timestamp),
          );
        },
      );
      for (const e of events)
        if (timestamps.has(e.block))
          e.args._timestamp = timestamps.get(e.block);
      const indexed = replay(events);
      if (BigInt(indexed.guildIds.size) !== count)
        throw new Error(
          "Event history is incomplete. Retrying the public RPC may resolve this.",
        );
      const guilds = await mapLimit(
        [...indexed.guildIds],
        async (id): Promise<Guild> => {
          const [guild, seasonScore] = await Promise.all([
            read("getGuild", [id], block.number),
            read("seasonScore", [id, season], block.number),
          ]);
          const g = guild as [
            Address,
            string,
            number,
            boolean,
            number,
            number,
            number,
            number,
          ];
          const s = seasonScore as [bigint, number, bigint];
          return {
            id,
            captain: g[0],
            name: g[1],
            seats: g[2],
            recruiting: g[3],
            memberCount: g[4],
            tierPoints: g[5],
            tier: g[6],
            captainActiveDay: g[7],
            total: s[0],
            seasonMembers: s[1],
            average: s[2],
          };
        },
      );
      const addresses = new Set([
        ...indexed.roster.keys(),
        ...indexed.looking,
        ...(connected ? [lower(connected)] : []),
      ]);
      const people = await mapLimit([...addresses], async (address) => {
        const m = await readMember(
          address as Address,
          season as bigint,
          block.number,
        );
        const last = indexed.lastChecks.get(lower(address));
        return {
          ...m,
          flags: last ? Number(last.args.flags) : undefined,
          lastPoints: last ? Number(last.args.points) : undefined,
        };
      });
      const oldKeys = new Set(snapshot.events.map((e) => `${e.tx}:${e.index}`));
      const newChecks = snapshot.block
        ? events.filter(
            (e) => e.name === "CheckedIn" && !oldKeys.has(`${e.tx}:${e.index}`),
          )
        : [];
      notify({
        status: "ready",
        refreshing: false,
        guilds,
        people,
        events,
        indexed,
        newChecks,
        block: block.number,
        season: season as bigint,
        minPower: minPower as bigint,
        timestamp: Number(block.timestamp),
        updatedAt: Date.now(),
        verified: true,
        progress: "",
      });
    } catch (error) {
      notify({
        ...snapshot,
        status: "error",
        refreshing: false,
        error:
          error instanceof Error &&
          /Event history|Contract verification|public read endpoint/.test(
            error.message,
          )
            ? error.message
            : friendlyError(error),
        progress: "",
      });
    }
  })().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

export function startStore() {
  void refresh();
  timer ??= setInterval(() => {
    if (!document.hidden) void refresh();
  }, 30_000);
  const onVisible = () => {
    if (!document.hidden) void refresh();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function setConnected(address?: Address) {
  if (address === connected) return;
  connected = address;
  void refresh().then(() => {
    if (
      address &&
      address === connected &&
      snapshot.status === "ready" &&
      !snapshot.people.some((p) => lower(p.address) === lower(address))
    )
      void refresh();
  });
}
