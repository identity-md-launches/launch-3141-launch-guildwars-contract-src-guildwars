import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CHAIN_ID, friendlyError, simulate } from "./chain";
import { Hamster } from "./art";
import {
  ConnectPrompt,
  Empty,
  MemberBadges,
  SectionTitle,
  TierBadge,
  WalletAddress,
} from "./components";
import { Icon } from "./icons";
import {
  TIER_FLOORS,
  TIERS,
  guildLabel,
  liveStreak,
  lower,
  score,
  utcDay,
} from "./model";
import { useGame } from "./store";
import { useTransaction } from "./Transactions";
import { inviteCode } from "./CreateJoin";
import { keccak256, toHex } from "viem";

const KICK_NOTICE =
  "Removing a member also removes their points from this season's guild score. The member can join again with the invite code.";

export function MyGuild({ guildId }: { guildId?: bigint }) {
  const game = useGame();
  const { address, chainId } = useAccount();
  const { act, busy } = useTransaction();
  const [preview, setPreview] = useState<number>();
  const [previewError, setPreviewError] = useState("");
  const me = game.people.find(
    (p) => lower(p.address) === address?.toLowerCase(),
  );
  const guild = game.guilds.find((g) => g.id === (guildId ?? me?.guildId));
  const mine = guild && me?.guildId === guild.id;
  const captain = mine && lower(guild.captain) === address?.toLowerCase();
  const checkedToday = me && me.lastCheckInDay >= utcDay();
  useEffect(() => {
    let cancelled = false;
    setPreview(undefined);
    setPreviewError("");
    if (address && mine && !checkedToday && game.verified) {
      simulate("checkIn", [], address)
        .then((points) => {
          if (!cancelled) setPreview(points);
        })
        .catch((e) => {
          if (!cancelled) setPreviewError(friendlyError(e));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [address, mine, checkedToday, game.updatedAt, game.verified]);
  if (!guildId && !address)
    return (
      <>
        <div className="page-title">
          <h1>My guild</h1>
          <p>Your crew. Your daily contribution.</p>
        </div>
        <ConnectPrompt />
      </>
    );
  if (game.block === undefined || (address && !guildId && !me))
    return (
      <div className="loading-state">
        {game.status === "error"
          ? "Unable to load your guild. Use Refresh below."
          : "Reading your guild…"}
      </div>
    );
  if (!guild)
    return (
      <>
        <div className="page-title">
          <h1>{guildId ? "Guild not found" : "My guild"}</h1>
        </div>
        <div className="card">
          <Empty
            title={
              guildId
                ? "This guild is not in the registry."
                : "You haven’t joined a guild yet."
            }
          >
            Create your own team, or ask a captain for an invite code.
          </Empty>
          <p className="empty-secondary">
            <a className="text-link" href="#create/join">
              Join with a code <Icon name="arrow" size={16} />
            </a>
          </p>
        </div>
      </>
    );
  const members = game.people
    .filter((p) => p.guildId === guild.id)
    .sort((a, b) => b.points - a.points);
  const removals = game.events
    .filter(
      (event) => event.name === "Kicked" && event.args.guildId === guild.id,
    )
    .slice(-5)
    .reverse();
  const nextTier = Math.min(guild.tier + 1, 3);
  const floor = TIER_FLOORS[guild.tier];
  const next = TIER_FLOORS[nextTier];
  const progress =
    guild.tier === 3
      ? 100
      : Math.max(
          0,
          Math.min(100, ((guild.tierPoints - floor) / (next - floor)) * 100),
        );
  const disabled =
    busy || chainId !== CHAIN_ID || !game.verified || game.status !== "ready";
  return (
    <>
      <div className="page-title">
        <h1>{mine ? "My guild" : "Guild profile"}</h1>
        <p>Show up for your team.</p>
      </div>
      <div className="guild-overview card">
        <Hamster id={guild.id} name={guild.name} />
        <div className="guild-overview-copy">
          <TierBadge tier={guild.tier} />
          <h2 className="guild-heading">{guildLabel(guild)}</h2>
          <p className="muted">
            {guild.memberCount} / {guild.seats} seats ·{" "}
            {guild.recruiting ? "Recruiting" : "Recruiting closed"}
          </p>
          <div className="tier-progress-label">
            <span>{guild.tierPoints.toLocaleString()} tier points</span>
            <span>
              {guild.tier === 3
                ? "Legend reached"
                : `${next.toLocaleString()} to ${TIERS[nextTier]}`}
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Progress within current tier"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="guild-average">
          <span className="label">Season average</span>
          <strong>{score(guild.average)}</strong>
          <span className="fine muted">points per member</span>
        </div>
      </div>
      {mine && (
        <section className="checkin-panel card">
          <div>
            <SectionTitle>Daily check-in</SectionTitle>
            <p>
              {checkedToday
                ? "You showed up today. Your next check-in opens at 00:00 UTC."
                : "One small check-in. One stronger guild."}
            </p>
            <div className="points-breakdown">
              <span>
                Base <strong>10</strong>
              </span>
              <span>
                Round{" "}
                <strong>
                  {checkedToday
                    ? me?.flags === undefined
                      ? "—"
                      : me.flags & 1
                        ? "×2"
                        : "×1"
                    : preview === undefined
                      ? "×1 or ×2"
                      : preview >= 20
                        ? "×2"
                        : "×1"}
                </strong>
              </span>
              <span>
                Staker{" "}
                <strong>
                  {checkedToday
                    ? me?.flags === undefined
                      ? "—"
                      : me.flags & 2
                        ? "×1.25"
                        : "×1"
                    : preview === undefined
                      ? "×1 or ×1.25"
                      : preview === 12 || preview === 25
                        ? "×1.25"
                        : "×1"}
                </strong>
              </span>
              <span className="points-total">
                {checkedToday ? "Last earned" : "Estimated"}{" "}
                <strong>
                  {checkedToday ? (me?.lastPoints ?? "—") : (preview ?? "…")}
                </strong>
              </span>
            </div>
            <p className="fine muted">
              {checkedToday
                ? "Bonus badges reflect your last check-in."
                : preview === undefined
                  ? "Reading the exact points from a public-RPC simulation."
                  : "Contract simulation for your wallet. The staker-only result rounds 12.5 down to 12. Bonuses can change before confirmation."}
            </p>
            {previewError && (
              <p className="error" role="alert">
                {previewError}
              </p>
            )}
          </div>
          <button
            className="primary"
            disabled={disabled || checkedToday || preview === undefined}
            onClick={() =>
              act({
                name: "checkIn",
                args: [],
                title: "Check in for today?",
                explanation: `Record your daily check-in for “${guildLabel(guild)}”. The current simulation awards ${preview} season points. This updates your streak and guild average. Bonuses are determined by the contract at execution.`,
              })
            }
          >
            <Icon name="check" />
            {checkedToday
              ? "Checked in today"
              : `Check in${preview !== undefined ? ` · +${preview} pts` : ""}`}
          </button>
        </section>
      )}
      <section>
        <SectionTitle
          aside={<span className="fine muted">{members.length} members</span>}
        >
          The crew
        </SectionTitle>
        {captain && <p className="fine muted">{KICK_NOTICE}</p>}
        <div className="card member-list">
          {members.length === 0 ? (
            <Empty
              title="This guild has no members."
              action={false}
              art={false}
            />
          ) : (
            members.map((member) => {
              const isCaptain = lower(member.address) === lower(guild.captain);
              const inactive =
                utcDay() >=
                Math.max(member.joinedDay, member.lastCheckInDay) + 14;
              return (
                <div className="member-row" key={member.address}>
                  <div className="member-identity">
                    <WalletAddress address={member.address} />
                    <span className="fine muted">
                      {isCaptain ? "Captain" : "Member"} ·{" "}
                      {member.lastCheckInDay
                        ? `Last check-in ${new Date(member.lastCheckInDay * 86400000).toISOString().slice(0, 10)} UTC`
                        : "No check-in yet"}
                    </span>
                    <MemberBadges member={member} />
                  </div>
                  <div className="member-stats">
                    <span>
                      <strong>{member.points}</strong> pts
                    </span>
                    <span>
                      <strong>{liveStreak(member)}</strong> day streak
                    </span>
                  </div>
                  {address && !isCaptain && (
                    <div className="member-actions">
                      {captain && (
                        <>
                          <button
                            className="secondary compact"
                            disabled={disabled}
                            onClick={() =>
                              act({
                                name: "kick",
                                args: [member.address],
                                title: "Remove this member?",
                                explanation: `Remove ${member.address} from “${guildLabel(guild)}”. ${KICK_NOTICE}`,
                              })
                            }
                          >
                            Remove
                          </button>
                          <button
                            className="secondary compact"
                            disabled={disabled}
                            onClick={() =>
                              act({
                                name: "transferCaptain",
                                args: [member.address],
                                title: "Transfer captain?",
                                explanation: `Make ${member.address} the captain of “${guildLabel(guild)}”. You give up all captain tools. They can manage recruiting, the invite code, and members.`,
                              })
                            }
                          >
                            Make captain
                          </button>
                        </>
                      )}
                      {inactive && (
                        <button
                          className="secondary compact"
                          disabled={disabled}
                          onClick={() =>
                            act({
                              name: "removeInactive",
                              args: [member.address],
                              title: "Remove inactive member?",
                              explanation: `Remove ${member.address} after 14 days without a check-in. Their current-season points are removed from the guild total. Anyone can submit this action.`,
                            })
                          }
                        >
                          Remove inactive
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="fine muted table-note">
          Staker badges show the bonus recorded at the last check-in, not a
          current staking balance. Streaks are consecutive UTC days.
        </p>
      </section>
      <section className="recent-changes">
        <SectionTitle>Recent changes</SectionTitle>
        {removals.length ? (
          <ul className="recent-changes-list">
            {removals.map((event) => {
              const timestamp = event.args._timestamp as number | undefined;
              const date =
                timestamp === undefined
                  ? undefined
                  : new Date(timestamp * 1000);
              return (
                <li key={`${event.tx}:${event.index}`}>
                  <div>
                    <span className="fine muted">Removed</span>{" "}
                    <WalletAddress address={String(event.args.wallet)} />
                  </div>
                  {date ? (
                    <time className="fine muted" dateTime={date.toISOString()}>
                      {date
                        .toISOString()
                        .replace("T", " ")
                        .replace(".000Z", " UTC")}
                    </time>
                  ) : (
                    <span className="fine muted">Block time unavailable</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="fine muted">
            No member removals recorded for this guild.
          </p>
        )}
      </section>
      {mine && (
        <section className="guild-tools">
          <SectionTitle>
            {captain ? "Captain tools" : "Membership"}
          </SectionTitle>
          <div className="card tools-panel">
            {captain && (
              <>
                <div>
                  <h3>Recruiting</h3>
                  <p className="muted">
                    {guild.recruiting
                      ? "New members can join with your invite code."
                      : "New joins are closed, even with a valid code."}
                  </p>
                  <button
                    className="secondary"
                    disabled={disabled}
                    onClick={() =>
                      act({
                        name: "setRecruiting",
                        args: [!guild.recruiting],
                        title: guild.recruiting
                          ? "Close recruiting?"
                          : "Open recruiting?",
                        explanation: guild.recruiting
                          ? "Close recruiting for your guild. Current members stay; new joins are blocked until you reopen it."
                          : "Open recruiting for your guild. Anyone with the current code can join while seats remain.",
                      })
                    }
                  >
                    {guild.recruiting ? "Close recruiting" : "Open recruiting"}
                  </button>
                </div>
                <div>
                  <h3>Invite code</h3>
                  <p className="muted">
                    Rotate after a code becomes public. Members stay.
                  </p>
                  <button
                    className="secondary"
                    disabled={disabled}
                    onClick={() => {
                      const code = inviteCode();
                      act({
                        name: "setInviteCode",
                        args: [keccak256(toHex(code))],
                        title: "Rotate invite code?",
                        explanation:
                          "Replace your guild’s invite-code hash. The old code stops working. Save the new code after confirmation; it is shown once.",
                        code,
                      });
                    }}
                  >
                    Generate new code
                  </button>
                </div>
              </>
            )}
            {!captain && utcDay() >= guild.captainActiveDay + 14 && (
              <div>
                <h3>Inactive captain</h3>
                <p className="muted">
                  The captain has not checked in for at least 14 UTC days.
                </p>
                <button
                  className="secondary"
                  disabled={disabled}
                  onClick={() =>
                    act({
                      name: "claimCaptain",
                      args: [],
                      title: "Claim the captain role?",
                      explanation: `Become captain of “${guildLabel(guild)}” because its captain has been inactive for 14 days. You receive all captain tools.`,
                    })
                  }
                >
                  Claim captain
                </button>
              </div>
            )}
            <div>
              <h3>Leave the guild</h3>
              <p className="muted">
                Your season points leave too. You must wait 24 hours before
                joining or creating another guild.
                {captain && guild.memberCount > 1
                  ? " Transfer captain first."
                  : ""}
              </p>
              <button
                className="secondary danger"
                disabled={disabled || (captain && guild.memberCount > 1)}
                onClick={() =>
                  act({
                    name: "leave",
                    args: [],
                    title: "Leave this guild?",
                    explanation: `Leave “${guildLabel(guild)}” and remove your current-season points from its score. A 24-hour cool-down prevents you from joining or creating a guild. ${guild.memberCount === 1 ? "As the last member, leaving will close this guild." : ""}`,
                  })
                }
              >
                Leave guild
              </button>
            </div>
          </div>
          {chainId !== CHAIN_ID && (
            <p className="notice">Switch to Sepolia to use guild actions.</p>
          )}
        </section>
      )}
    </>
  );
}
