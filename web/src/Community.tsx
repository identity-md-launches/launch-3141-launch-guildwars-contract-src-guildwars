import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isAddress, type Address } from "viem";
import { CHAIN_ID, EXPLORER, friendlyError } from "./chain";
import { Emblem, Trophy } from "./art";
import {
  Empty,
  GuildName,
  HistoryStatus,
  MemberBadges,
  SectionTitle,
  TierBadge,
  WalletAddress,
} from "./components";
import { Icon } from "./icons";
import {
  TIERS,
  liveStreak,
  lower,
  podiums,
  score,
  seasonLabel,
  titleFor,
  type Member,
} from "./model";
import { readMember, useGame } from "./store";
import { useTransaction } from "./Transactions";
import { openWallet } from "./Wallet";

export function Recruiting() {
  const game = useGame();
  const { address, chainId } = useAccount();
  const { act, busy } = useTransaction();
  const me = game.people.find(
    (p) => lower(p.address) === address?.toLowerCase(),
  );
  const recruiting = game.guilds.filter(
    (g) => g.recruiting && g.memberCount > 0 && g.memberCount < g.seats,
  );
  const looking = game.people.filter((p) => p.looking && p.guildId === 0n);
  return (
    <>
      <div className="page-title">
        <h1>There’s a seat for you.</h1>
        <p>Find a crew, or let a crew find you.</p>
      </div>
      <section>
        <SectionTitle
          aside={
            <span className="fine muted">
              {game.block !== undefined
                ? `${recruiting.length} open guilds`
                : game.status === "error"
                  ? "History unavailable"
                  : "Reading…"}
            </span>
          }
        >
          Open seats
        </SectionTitle>
        <div className="recruit-grid">
          {game.block === undefined ? (
            <div className="card">
              <HistoryStatus loading="Reading recruiting guilds…" />
            </div>
          ) : recruiting.length ? (
            recruiting.map((guild) => (
              <article className="card recruit-card" key={String(guild.id)}>
                <GuildName guild={guild} />
                <div className="recruit-meta">
                  <TierBadge tier={guild.tier} />
                  <span>{guild.seats - guild.memberCount} open seats</span>
                </div>
                <p className="fine muted">Captain</p>
                <WalletAddress address={guild.captain} />
                <a className="secondary" href="#create/join">
                  Join with a code
                  <Icon name="arrow" size={16} />
                </a>
              </article>
            ))
          ) : (
            <div className="card">
              <Empty title="No open guilds yet.">
                Create a guild and make room for your crew.
              </Empty>
            </div>
          )}
        </div>
      </section>
      <section>
        <SectionTitle>The looking-for-guild board</SectionTitle>
        <div className="board-optin card">
          <div>
            <h3>
              {me?.looking
                ? "You’re listed on the board"
                : "Let captains know you’re looking"}
            </h3>
            <p className="muted">
              Opt in to publish your wallet here. Your profile has game activity
              only. You can remove your listing at any time.
            </p>
            {me?.guildId ? (
              <p className="fine muted">
                Only wallets outside a guild appear on this board. Your opt-in
                stays on chain until you turn it off.
              </p>
            ) : null}
          </div>
          <button
            className="primary"
            disabled={
              busy ||
              Boolean(address && chainId !== CHAIN_ID) ||
              !game.verified ||
              game.status !== "ready" ||
              Boolean(address && !me)
            }
            onClick={() =>
              address
                ? act({
                    name: "setLookingForGuild",
                    args: [!me?.looking],
                    title: me?.looking
                      ? "Remove your listing?"
                      : "Join the recruiting board?",
                    explanation: me?.looking
                      ? "Set your looking-for-guild status to off. Your wallet is removed from the current board. The earlier opt-in event remains public on Sepolia."
                      : "Publicly mark your wallet as looking for a guild. Your address and public game profile will appear on the board while you are outside a guild. You can turn this off at any time.",
                  })
                : openWallet()
            }
          >
            {address
              ? me?.looking
                ? "Remove my listing"
                : "List my wallet"
              : "Connect to opt in"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="card">
          {game.block === undefined ? (
            <HistoryStatus loading="Reading public listings…" />
          ) : looking.length === 0 ? (
            <Empty
              title="No wallets on the board yet."
              action={false}
              art={false}
            >
              The board is opt-in. Be the first to say you’re looking.
            </Empty>
          ) : (
            looking.map((member) => (
              <div className="member-row" key={member.address}>
                <div className="member-identity">
                  <WalletAddress address={member.address} />
                  <MemberBadges member={member} />
                </div>
                <span className="fine muted">
                  {liveStreak(member)} day streak
                </span>
                <a className="secondary" href={`#profile/${member.address}`}>
                  View profile
                  <Icon name="arrow" size={16} />
                </a>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

const TITLES = [
  { days: 7, title: "Week warrior", text: "Seven days, every day." },
  { days: 30, title: "Unstoppable paws", text: "A full month of showing up." },
  {
    days: 100,
    title: "Century squeeker",
    text: "One hundred days. One big streak.",
  },
];
export function Trophies() {
  const game = useGame();
  const seasons = [
    ...new Set(
      game.indexed.wars
        .filter((w) => game.season !== undefined && w.season < game.season)
        .map((w) => String(w.season)),
    ),
  ].sort((a, b) => Number(b) - Number(a));
  const best = new Map<string, number>();
  game.events
    .filter((e) => e.name === "CheckedIn")
    .forEach((e) => {
      const address = lower(String(e.args.wallet));
      best.set(
        address,
        Math.max(best.get(address) ?? 0, Number(e.args.streak)),
      );
    });
  return (
    <>
      <div className="page-title">
        <h1>Bragging rights, earned.</h1>
        <p>Little trophies for a whole lot of showing up.</p>
      </div>
      <section>
        <SectionTitle>Season podiums</SectionTitle>
        <p className="muted measure">
          Top three recorded averages among guilds in submitted WarResult
          events. These are cosmetic community trophies, with no token or
          payout. Equal scores are ordered by guild ID for display.
        </p>
        {game.block === undefined ? (
          <div className="card">
            <HistoryStatus />
          </div>
        ) : seasons.length ? (
          seasons.map((s) => (
            <div key={s} className="podium-season">
              <h3>Week of {seasonLabel(BigInt(s))}</h3>
              <div className="podium-grid">
                {podiums(game.indexed.wars, BigInt(s)).map((entry, index) => {
                  const guild = game.guilds.find((g) => g.id === entry.id);
                  return (
                    <article
                      className="card podium-card"
                      key={String(entry.id)}
                    >
                      <Trophy place={index + 1} />
                      <span className="label">Place {index + 1}</span>
                      <h3>{guild?.name ?? `Guild #${entry.id}`}</h3>
                      <p>{score(entry.score)} points / member</p>
                      <a className="text-link" href={`#guild/${entry.id}`}>
                        View guild
                        <Icon name="arrow" size={16} />
                      </a>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="card trophy-empty">
            <div className="trophy-preview" aria-hidden="true">
              <Trophy place={2} />
              <Trophy place={1} />
              <Trophy place={3} />
            </div>
            <Empty
              title="The trophy cabinet is waiting."
              action={false}
              art={false}
            >
              No season trophies awarded yet. Podiums appear when past-season
              wars are submitted.
            </Empty>
          </div>
        )}
      </section>
      <section>
        <SectionTitle>Climb the tiers</SectionTitle>
        <div className="tier-gallery">
          {TIERS.map((tier, index) => (
            <div className="card tier-display" key={tier}>
              <Emblem tier={index} size={54} />
              <h3>{tier}</h3>
              <p className="muted">
                {[0, 1000, 3000, 6000][index].toLocaleString()} tier points
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Streak titles</SectionTitle>
        <div className="title-gallery">
          {TITLES.map((title) => (
            <div className="card title-display" key={title.days}>
              <span className="title-days">
                {title.days}
                <span>days</span>
              </span>
              <h3>{title.title}</h3>
              <p className="muted">{title.text}</p>
              <span className="fine muted">
                {game.block !== undefined
                  ? `${[...best.values()].filter((n) => n >= title.days).length} recorded achievers`
                  : game.status === "error"
                    ? "History unavailable"
                    : "Reading history…"}
              </span>
            </div>
          ))}
        </div>
        {[...best].some(([, streak]) => streak >= 7) && (
          <div className="card achievers">
            {[...best]
              .filter(([, streak]) => streak >= 7)
              .sort((a, b) => b[1] - a[1])
              .map(([address, streak]) => (
                <div className="member-row" key={address}>
                  <WalletAddress address={address} />
                  <span className="badge">{titleFor(streak)}</span>
                  <span>{streak} day best</span>
                </div>
              ))}
          </div>
        )}
        <p className="fine muted table-note">
          A title is earned when a CheckedIn event records the milestone. Past
          achievements stay in event history.
        </p>
      </section>
    </>
  );
}

export function Profile({ wallet }: { wallet: string }) {
  const game = useGame();
  const cached = game.people.find((p) => lower(p.address) === lower(wallet));
  const [person, setPerson] = useState<Member>();
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setPerson(undefined);
    setError("");
    if (!isAddress(wallet) || game.season === undefined) return;
    if (cached) {
      setPerson(cached);
      return;
    }
    readMember(wallet as Address, game.season, game.block)
      .then((p) => {
        if (!cancelled) setPerson(p);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, cached, game.season, game.block, game.updatedAt]);
  const guild = game.guilds.find((g) => g.id === person?.guildId);
  const checkins = game.events.filter(
    (e) =>
      e.name === "CheckedIn" && lower(String(e.args.wallet)) === lower(wallet),
  );
  const best = Math.max(0, ...checkins.map((e) => Number(e.args.streak)));
  const last = checkins.at(-1);
  return (
    <>
      <div className="page-title">
        <h1>Public player profile</h1>
        <p>Only public GuildWars activity appears here.</p>
      </div>
      {!isAddress(wallet) ? (
        <p className="error">
          This wallet address is invalid. Choose a player from the recruiting
          board.
        </p>
      ) : (
        <section className="card profile-panel">
          <WalletAddress address={wallet} profile={false} />
          {game.block === undefined ? (
            <HistoryStatus loading="Reading this wallet’s game activity…" />
          ) : error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : !person ? (
            <p className="muted">Reading this wallet’s game activity…</p>
          ) : (
            <>
              <div className="profile-stats">
                <div>
                  <span className="label">Current streak</span>
                  <strong>{liveStreak(person)} days</strong>
                </div>
                <div>
                  <span className="label">Best recorded</span>
                  <strong>{best} days</strong>
                </div>
                <div>
                  <span className="label">Season points</span>
                  <strong>{person.points}</strong>
                </div>
              </div>
              <MemberBadges
                member={{
                  ...person,
                  flags: last ? Number(last.args.flags) : undefined,
                }}
              />
              <p>
                {guild ? (
                  <>
                    Guild:{" "}
                    <a className="text-link" href={`#guild/${guild.id}`}>
                      {guild.name}
                    </a>
                  </>
                ) : (
                  "Not currently in a guild."
                )}
              </p>
              <p className="muted">
                {person.looking
                  ? "Opted in as looking for a guild."
                  : "Not listed on the recruiting board."}
              </p>
              {person.cooldownUntil > BigInt(Math.floor(Date.now() / 1000)) && (
                <p className="notice">
                  Leave cool-down ends{" "}
                  {new Date(Number(person.cooldownUntil) * 1000).toUTCString()}.
                </p>
              )}
              <h2>Earned titles</h2>
              <div className="actions">
                {TITLES.filter((t) => best >= t.days).map((t) => (
                  <span className="badge" key={t.days}>
                    {t.title}
                  </span>
                ))}
                {best < 7 && (
                  <p className="muted">
                    No streak titles yet. First milestone: 7 consecutive UTC
                    days.
                  </p>
                )}
              </div>
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={`${EXPLORER}/address/${wallet}`}
              >
                View wallet on Etherscan
                <Icon name="external" size={16} />
              </a>
            </>
          )}
        </section>
      )}
    </>
  );
}
