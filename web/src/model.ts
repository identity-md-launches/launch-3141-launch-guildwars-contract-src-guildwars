import { decodeEventLog, type Address, type Log } from "viem";
import { abi } from "./chain";

export const TIERS = ["Bronze", "Silver", "Gold", "Legend"] as const;
export const TIER_FLOORS = [0, 1000, 3000, 6000];
export type GameEvent = {
  name: string;
  args: Record<string, unknown>;
  block: bigint;
  index: number;
  tx: string;
};
export type Guild = {
  id: bigint;
  captain: Address;
  name: string;
  seats: number;
  recruiting: boolean;
  memberCount: number;
  tierPoints: number;
  tier: number;
  captainActiveDay: number;
  total: bigint;
  seasonMembers: number;
  average: bigint;
};
export type Member = {
  address: Address;
  guildId: bigint;
  joinedDay: number;
  lastCheckInDay: number;
  streak: number;
  lastRound: bigint;
  roundKnown: boolean;
  looking: boolean;
  cooldownUntil: bigint;
  points: number;
  flags?: number;
  lastPoints?: number;
};
export type War = {
  season: bigint;
  a: bigint;
  b: bigint;
  scoreA: bigint;
  scoreB: bigint;
  winner: bigint;
  tx: string;
};
export type Replay = {
  roster: Map<string, bigint>;
  looking: Set<string>;
  lastChecks: Map<string, GameEvent>;
  wars: War[];
  guildIds: Set<bigint>;
};
export const lower = (a: string) => a.toLowerCase();
export const guildLabel = (guild: Pick<Guild, "id" | "name">) =>
  `${guild.name} #${guild.id}`;
export const normalizeGuildName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
export function matchingGuildIds(events: GameEvent[], name: string) {
  const normalized = normalizeGuildName(name);
  if (!normalized) return [];
  return events
    .filter(
      (event) =>
        event.name === "GuildCreated" &&
        typeof event.args.name === "string" &&
        normalizeGuildName(event.args.name) === normalized,
    )
    .map((event) => event.args.guildId as bigint);
}
export function seasonDepartures(
  events: GameEvent[],
  guildId: bigint,
  season: bigint,
) {
  return events.filter((event) => {
    const timestamp = event.args._timestamp;
    return (
      (event.name === "Left" || event.name === "Kicked") &&
      event.args.guildId === guildId &&
      typeof timestamp === "number" &&
      seasonAt(timestamp) === season
    );
  }).length;
}
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const score = (value: bigint) =>
  (Number(value) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 3 });
export const utcDay = () => Math.floor(Date.now() / 86_400_000);
export const seasonAt = (timestamp: number) =>
  BigInt(Math.floor((Math.floor(timestamp / 86400) + 3) / 7));
export const seasonStart = (season: bigint) =>
  (Number(season) * 7 - 3) * 86_400_000;
export const seasonLabel = (season: bigint) =>
  new Date(seasonStart(season)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function liveStreak(member: Member) {
  return utcDay() - member.lastCheckInDay <= 1 ? member.streak : 0;
}
export function titleFor(streak: number) {
  return streak >= 100
    ? "Century squeeker"
    : streak >= 30
      ? "Unstoppable paws"
      : streak >= 7
        ? "Week warrior"
        : undefined;
}
export function decodeLogs(logs: Log[]): GameEvent[] {
  return logs.flatMap((log) => {
    try {
      const decoded = decodeEventLog({
        abi,
        topics: log.topics,
        data: log.data,
        strict: true,
      }) as unknown as { eventName: string; args: Record<string, unknown> };
      return [
        {
          name: decoded.eventName,
          args: decoded.args,
          block: log.blockNumber!,
          index: log.logIndex!,
          tx: log.transactionHash!,
        },
      ];
    } catch {
      return [];
    }
  });
}
export function replay(events: GameEvent[]): Replay {
  const result: Replay = {
    roster: new Map(),
    looking: new Set(),
    lastChecks: new Map(),
    wars: [],
    guildIds: new Set(),
  };
  for (const e of events) {
    const a = e.args;
    const wallet = typeof a.wallet === "string" ? lower(a.wallet) : "";
    if (e.name === "GuildCreated") {
      result.guildIds.add(a.guildId as bigint);
      result.roster.set(lower(a.captain as string), a.guildId as bigint);
    }
    if (e.name === "Joined") result.roster.set(wallet, a.guildId as bigint);
    if (e.name === "Left" || e.name === "Kicked") result.roster.delete(wallet);
    if (e.name === "LookingForGuild") {
      if (a.looking) result.looking.add(wallet);
      else result.looking.delete(wallet);
    }
    if (e.name === "CheckedIn") result.lastChecks.set(wallet, e);
    if (e.name === "WarResult")
      result.wars.push({
        season: a.season as bigint,
        a: a.guildA as bigint,
        b: a.guildB as bigint,
        scoreA: a.scoreA as bigint,
        scoreB: a.scoreB as bigint,
        winner: a.winner as bigint,
        tx: e.tx,
      });
  }
  return result;
}

// Membership and scoring at a historic season boundary, including points removed on departure.
export function historicalMembers(
  events: GameEvent[],
  guildId: bigint,
  season: bigint,
) {
  const roster = new Map<string, bigint>();
  const points = new Map<string, number>();
  const endSeason = season + 1n;
  for (const e of events) {
    const a = e.args;
    const eventSeason =
      e.name === "CheckedIn" ? (a.season as bigint) : undefined;
    if (eventSeason !== undefined && eventSeason >= endSeason) continue;
    // Non-check-in membership events carry block timestamps attached by the indexer.
    const eventTimestamp = a._timestamp as number | undefined;
    if (eventTimestamp && seasonAt(eventTimestamp) >= endSeason) continue;
    const wallet = typeof a.wallet === "string" ? lower(a.wallet) : "";
    if (e.name === "GuildCreated")
      roster.set(lower(a.captain as string), a.guildId as bigint);
    if (e.name === "Joined") roster.set(wallet, a.guildId as bigint);
    if (e.name === "Left" || e.name === "Kicked") {
      roster.delete(wallet);
      if (eventTimestamp && seasonAt(eventTimestamp) === season)
        points.set(wallet, 0);
    }
    if (e.name === "CheckedIn" && eventSeason === season)
      points.set(wallet, (points.get(wallet) ?? 0) + Number(a.points));
  }
  return [...roster]
    .filter(([, id]) => id === guildId)
    .map(([address]) => ({ address, points: points.get(address) ?? 0 }));
}

export function podiums(wars: War[], season: bigint) {
  const scores = new Map<string, { id: bigint; score: bigint }>();
  for (const war of wars.filter((w) => w.season === season)) {
    scores.set(String(war.a), { id: war.a, score: war.scoreA });
    scores.set(String(war.b), { id: war.b, score: war.scoreB });
  }
  return [...scores.values()]
    .sort((a, b) =>
      a.score === b.score ? Number(a.id - b.id) : a.score > b.score ? -1 : 1,
    )
    .slice(0, 3);
}

export async function mapLimit<T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
  limit = 5,
): Promise<U[]> {
  const result: U[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        result[index] = await fn(items[index]);
      }
    }),
  );
  return result;
}
