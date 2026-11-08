import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { CHAIN_ID, EXPLORER, friendlyError, read } from "./chain";
import { Hamster, downloadSvg, shareCard } from "./art";
import {
  Empty,
  HistoryStatus,
  SectionTitle,
  TierBadge,
  WalletAddress,
} from "./components";
import { Icon } from "./icons";
import {
  historicalMembers,
  lower,
  score,
  seasonLabel,
  type Guild,
} from "./model";
import { useGame } from "./store";
import { useTransaction } from "./Transactions";

type WarState = {
  scoreA: bigint;
  scoreB: bigint;
  countA: number;
  countB: number;
  tierA: number;
  tierB: number;
  doneA: boolean;
  doneB: boolean;
  totalA: bigint;
  totalB: bigint;
};
export function TugOfWar({
  a,
  b,
  scoreA,
  scoreB,
}: {
  a: Guild;
  b: Guild;
  scoreA: bigint;
  scoreB: bigint;
}) {
  const game = useGame();
  const sum = scoreA + scoreB;
  const gap = sum === 0n ? 0 : Number(((scoreB - scoreA) * 1000n) / sum) / 1000;
  const flag = 50 + Math.max(-1, Math.min(1, gap)) * 30;
  const aPull = game.newChecks.filter((e) => e.args.guildId === a.id).at(-1);
  const bPull = game.newChecks.filter((e) => e.args.guildId === b.id).at(-1);
  const lead =
    scoreA === scoreB
      ? "Evenly matched"
      : `${scoreA > scoreB ? a.name : b.name} leads by ${score(scoreA > scoreB ? scoreA - scoreB : scoreB - scoreA)} points per member`;
  return (
    <div className="tug-arena" aria-label={lead} role="img">
      <div
        className={`tug-hamster team-a ${aPull ? "pull" : ""}`}
        key={`a-${aPull?.tx ?? "idle"}`}
      >
        <Hamster id={a.id} name={a.name} decorative />
      </div>
      <div
        className={`tug-hamster team-b ${bPull ? "pull" : ""}`}
        key={`b-${bPull?.tx ?? "idle"}`}
      >
        <Hamster id={b.id} name={b.name} decorative />
      </div>
      <div className="tug-rope">
        <span className="rope-tick" />
        <span className="rope-flag" style={{ left: `${flag}%` }} />
      </div>
      <div className="arena-ground" />
      <span className="tug-caption">{lead}</span>
    </div>
  );
}
export function WarPage() {
  const game = useGame();
  const { address, chainId } = useAccount();
  const { act, busy } = useTransaction();
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [state, setState] = useState<WarState>();
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const guilds = game.guilds;
  const historyPlaceholder =
    game.status === "error" ? "History unavailable" : "Reading…";
  const a = guilds.find((g) => String(g.id) === aId) ?? guilds[0];
  const b =
    guilds.find((g) => String(g.id) === bId) ??
    guilds.find((g) => g.id !== a?.id);
  const season = selectedSeason ? BigInt(selectedSeason) : game.season;
  const past =
    season !== undefined && game.season !== undefined && season < game.season;
  const seasons = useMemo(
    () =>
      [
        ...new Set([
          ...(game.season !== undefined ? [String(game.season)] : []),
          ...game.events
            .filter((e) => e.name === "CheckedIn" || e.name === "WarResult")
            .map((e) => String(e.args.season)),
        ]),
      ].sort((x, y) => Number(y) - Number(x)),
    [game.events, game.season],
  );
  useEffect(() => {
    let cancelled = false;
    setState(undefined);
    setError("");
    setDownloaded(false);
    if (!a || !b || season === undefined || !game.block) return;
    Promise.all([
      read("seasonScore", [a.id, season], game.block),
      read("seasonScore", [b.id, season], game.block),
      read("guildSeasonTier", [a.id, season], game.block),
      read("guildSeasonTier", [b.id, season], game.block),
      read("warDone", [season, a.id], game.block),
      read("warDone", [season, b.id], game.block),
    ])
      .then(([rawA, rawB, tierA, tierB, doneA, doneB]) => {
        if (cancelled) return;
        const sa = rawA as [bigint, number, bigint];
        const sb = rawB as [bigint, number, bigint];
        setState({
          scoreA: sa[2],
          scoreB: sb[2],
          countA: sa[1],
          countB: sb[1],
          totalA: sa[0],
          totalB: sb[0],
          tierA: Number(tierA),
          tierB: Number(tierB),
          doneA: Boolean(doneA),
          doneB: Boolean(doneB),
        });
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [a?.id, b?.id, season, game.block, retry]);
  const captain =
    address &&
    a &&
    b &&
    [lower(a.captain), lower(b.captain)].includes(lower(address));
  const result =
    a &&
    b &&
    game.indexed.wars.find(
      (w) =>
        w.season === season &&
        ((w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)),
    );
  const reason =
    !a || !b
      ? "Two guilds are needed to compare a war."
      : a.id === b.id
        ? "Choose two different guilds."
        : !past
          ? "This season is still running. Submit after Monday 00:00 UTC."
          : !state
            ? "Reading season eligibility…"
            : state.doneA || state.doneB
              ? "A guild in this pairing has already settled this season."
              : state.tierA !== state.tierB
                ? "Choose guilds with the same season tier."
                : !state.totalA ||
                    !state.totalB ||
                    !state.countA ||
                    !state.countB
                  ? "Both guilds must have checked in during this season."
                  : !captain
                    ? "Only the captain of either guild can submit this pairing."
                    : "";
  const roster = (guild: Guild) =>
    past && season !== undefined
      ? historicalMembers(game.events, guild.id, season)
      : game.people
          .filter((m) => m.guildId === guild.id)
          .map((m) => ({ address: m.address, points: m.points }));
  const leadPercent =
    state && state.scoreA + state.scoreB > 0n
      ? Number((state.scoreA * 10000n) / (state.scoreA + state.scoreB)) / 100
      : 50;
  return (
    <>
      <div className="page-title">
        <h1>A friendly tug of war.</h1>
        <p>Two guilds. One average that matters.</p>
      </div>
      <section className="card war-panel">
        <div className="war-picker">
          <label>
            First guild
            <select
              aria-label="First guild"
              value={a ? String(a.id) : ""}
              onChange={(e) => setAId(e.target.value)}
            >
              {!a && (
                <option value="">
                  {game.block === undefined
                    ? historyPlaceholder
                    : "No guilds yet"}
                </option>
              )}
              {guilds.map((g) => (
                <option key={String(g.id)} value={String(g.id)}>
                  {g.name} · #{String(g.id)}
                </option>
              ))}
            </select>
          </label>
          <span className="vs">VS</span>
          <label>
            Second guild
            <select
              aria-label="Second guild"
              value={b ? String(b.id) : ""}
              onChange={(e) => setBId(e.target.value)}
            >
              {!b && (
                <option value="">
                  {game.block === undefined
                    ? historyPlaceholder
                    : "No opponent yet"}
                </option>
              )}
              {guilds.map((g) => (
                <option key={String(g.id)} value={String(g.id)}>
                  {g.name} · #{String(g.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="war-season">
            Season
            <select
              aria-label="War season"
              value={season?.toString() ?? ""}
              onChange={(e) => setSelectedSeason(e.target.value)}
            >
              {season === undefined && (
                <option value="">{historyPlaceholder}</option>
              )}
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(BigInt(s))}
                  {BigInt(s) === game.season ? " · current" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {game.block === undefined ? (
          <HistoryStatus loading="Reading the arena…" />
        ) : !a || !b ? (
          <Empty title="A rivalry needs two guilds.">
            Once two guilds exist, compare their season averages here.
          </Empty>
        ) : error ? (
          <div className="empty-state">
            <p className="error" role="alert">
              {error}
            </p>
            <button
              className="secondary"
              onClick={() => setRetry((r) => r + 1)}
            >
              Retry comparison
            </button>
          </div>
        ) : !state ? (
          <div className="loading-state">
            <span className="spinner" />
            Reading season scores…
          </div>
        ) : (
          <>
            <div className="war-scoreboard">
              <div>
                <TierBadge tier={past ? state.tierA : a.tier} />
                <h2>{a.name}</h2>
                <strong>{score(state.scoreA)}</strong>
                <span className="fine muted">
                  points / member · {state.countA} members
                </span>
              </div>
              <span className="vs">VS</span>
              <div>
                <TierBadge tier={past ? state.tierB : b.tier} />
                <h2>{b.name}</h2>
                <strong>{score(state.scoreB)}</strong>
                <span className="fine muted">
                  points / member · {state.countB} members
                </span>
              </div>
            </div>
            <TugOfWar a={a} b={b} scoreA={state.scoreA} scoreB={state.scoreB} />
            <div
              className="lead-track"
              role="meter"
              aria-label={`${a.name} share of the combined average`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={leadPercent}
              aria-valuetext={`${leadPercent}%`}
            >
              <span style={{ width: `${leadPercent}%` }} />
            </div>
            <div className="war-state">
              <span className={`badge ${result ? "success" : ""}`}>
                {result
                  ? "Settled on Sepolia"
                  : past
                    ? "Season ended · comparison"
                    : "Live comparison"}
              </span>
              <button
                className="secondary"
                onClick={() => {
                  downloadSvg(
                    shareCard(
                      a,
                      b,
                      state.scoreA,
                      state.scoreB,
                      season!,
                      Boolean(result),
                    ),
                    `squeek-war-${season}-${a.id}-${b.id}.svg`,
                  );
                  setDownloaded(true);
                }}
              >
                <Icon name="external" size={16} />
                Download share card
              </button>
            </div>
            <p role="status" className="fine muted">
              {downloaded
                ? "SVG downloaded. You can share it anywhere."
                : "A comparison becomes a final war only when a captain submits the pairing."}
            </p>
            <div className="war-rosters">
              {[a, b].map((guild) => (
                <div key={String(guild.id)}>
                  <h3>{guild.name} · member scores</h3>
                  {roster(guild).map((member) => (
                    <div className="war-member" key={member.address}>
                      <WalletAddress address={member.address} />
                      <span>{member.points} pts</span>
                    </div>
                  ))}
                  {roster(guild).length === 0 && (
                    <p className="muted">No members at this season boundary.</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <section>
        <SectionTitle>Submit a war</SectionTitle>
        <div className="card submit-war">
          <div>
            <h3>Settle a completed season</h3>
            <p className="muted">
              The captain of either guild can submit. Both need a check-in, the
              same season tier, and an unsettled war. This pairing settles both
              guilds.
            </p>
            <p className="fine">
              Winner +300 tier points · tie +150 each · loser +0
            </p>
            <p className="notice">
              {reason ||
                "This pairing is eligible. Review it before asking your wallet to sign."}
            </p>
          </div>
          <button
            className="primary"
            disabled={
              Boolean(reason) ||
              busy ||
              chainId !== CHAIN_ID ||
              !game.verified ||
              game.status !== "ready"
            }
            onClick={() => {
              if (a && b && season !== undefined)
                act({
                  name: "submitWar",
                  args: [season, a.id, b.id],
                  title: "Submit this war?",
                  explanation: `Permanently settle season ${season} for “${a.name}” and “${b.name}”. Higher average wins +300 tier points; a tie gives +150 each. The loser loses no points. Both guilds use their one war for this season. The other captain cannot refuse this pairing.`,
                });
            }}
          >
            Review war submission
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>
      <section>
        <SectionTitle>Past results</SectionTitle>
        <div className="card results-list">
          {game.block === undefined ? (
            <HistoryStatus />
          ) : game.indexed.wars.length === 0 ? (
            <Empty title="No settled wars yet." action={false} art={false}>
              Results appear after a captain submits a completed season.
            </Empty>
          ) : (
            [...game.indexed.wars].reverse().map((war) => {
              const ga = guilds.find((g) => g.id === war.a);
              const gb = guilds.find((g) => g.id === war.b);
              return (
                <div className="result-row" key={war.tx}>
                  <div>
                    <span className="fine muted">
                      Week of {seasonLabel(war.season)}
                    </span>
                    <h3>
                      {ga?.name ?? `Guild #${war.a}`}{" "}
                      <span className="muted">vs</span>{" "}
                      {gb?.name ?? `Guild #${war.b}`}
                    </h3>
                    <p>
                      {score(war.scoreA)} : {score(war.scoreB)} pts / member ·{" "}
                      {war.winner === 0n
                        ? "Tie"
                        : `${guilds.find((g) => g.id === war.winner)?.name ?? `Guild #${war.winner}`} won`}
                    </p>
                  </div>
                  <a
                    className="secondary"
                    href={`${EXPLORER}/tx/${war.tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View result
                    <Icon name="external" size={16} />
                  </a>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
