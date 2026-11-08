import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { EXPLORER } from "./chain";
import { Emblem, Hamster } from "./art";
import { Icon } from "./icons";
import {
  TIERS,
  liveStreak,
  seasonStart,
  titleFor,
  type Guild,
  type Member,
} from "./model";
import { useGame, refresh } from "./store";
import { openWallet } from "./Wallet";

export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        <span className="section-square" aria-hidden="true" />
        {children}
      </h2>
      {aside}
    </div>
  );
}
export function Empty({
  title,
  children,
  action = true,
  art = true,
}: {
  title: string;
  children?: React.ReactNode;
  action?: boolean;
  art?: boolean;
}) {
  return (
    <div className="empty-state">
      {art && (
        <div className="empty-art">
          <Hamster id="welcome" name="Future guild" decorative />
          <span className="empty-spark" aria-hidden="true">
            +
          </span>
        </div>
      )}
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action && (
        <a className="primary" href="#create">
          <Icon name="plus" />
          Create a guild
        </a>
      )}
    </div>
  );
}
export function ConnectPrompt({
  message = "Connect a wallet to see your guild.",
}: {
  message?: string;
}) {
  return (
    <div className="card">
      <Empty title="Your guild starts with you" action={false}>
        <>{message}</>
      </Empty>
      <div className="center-action">
        <button className="primary" onClick={openWallet}>
          <Icon name="wallet" />
          Connect wallet
        </button>
        <a className="text-link" href="#create">
          Explore Create / Join <Icon name="arrow" size={16} />
        </a>
      </div>
    </div>
  );
}
export function TierBadge({
  tier,
  text = true,
}: {
  tier: number;
  text?: boolean;
}) {
  return (
    <span className={`tier-badge tier-${tier}`}>
      <Emblem tier={tier} size={24} />
      {text && TIERS[tier]}
    </span>
  );
}
export function GuildName({
  guild,
  small = false,
}: {
  guild: Guild;
  small?: boolean;
}) {
  return (
    <a
      className={`guild-name ${small ? "small" : ""}`}
      href={`#guild/${guild.id}`}
    >
      <Hamster id={guild.id} name={guild.name} decorative />
      <span>
        {guild.name}
        <span className="guild-id">Guild #{String(guild.id)}</span>
      </span>
    </a>
  );
}
export function WalletAddress({
  address,
  profile = true,
}: {
  address: string;
  profile?: boolean;
}) {
  return (
    <a
      className="address"
      href={profile ? `#profile/${address}` : `${EXPLORER}/address/${address}`}
      {...(!profile ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {address}
    </a>
  );
}
export function MemberBadges({ member }: { member: Member }) {
  const title = titleFor(liveStreak(member));
  return (
    <span className="member-badges">
      {member.flags !== undefined && Boolean(member.flags & 2) && (
        <span
          className="badge staker"
          title="Staker bonus was applied at this wallet’s last check-in"
        >
          Staker ×1.25
        </span>
      )}
      {title && <span className="badge">{title}</span>}
    </span>
  );
}
export function Countdown({ season }: { season?: bigint }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (season === undefined) return <span className="countdown">—</span>;
  const remaining = Math.max(
    0,
    Math.floor((seasonStart(season + 1n) - now) / 1000),
  );
  return (
    <span
      className="countdown"
      aria-label={`${Math.floor(remaining / 86400)} days, ${Math.floor((remaining % 86400) / 3600)} hours until the season ends`}
    >
      {Math.floor(remaining / 86400)}d{" "}
      {String(Math.floor((remaining % 86400) / 3600)).padStart(2, "0")}h{" "}
      {String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}m
    </span>
  );
}
export function ReadStatus() {
  const game = useGame();
  return (
    <div
      className={`read-status ${game.status === "error" ? "has-error" : ""}`}
    >
      <span className="status-dot" aria-hidden="true" />
      <span>
        {game.status === "loading"
          ? game.progress
          : game.status === "error"
            ? game.block
              ? "Read interrupted · showing the last snapshot"
              : "Unable to read Sepolia"
            : `Sepolia · block ${game.block?.toLocaleString("en-US")}`}
      </span>
      <button
        className="refresh-button"
        disabled={game.refreshing}
        onClick={() => void refresh()}
        aria-label="Refresh chain data"
      >
        <Icon name="refresh" size={14} />
        {game.refreshing ? "Reading…" : "Refresh"}
      </button>
      {game.status === "error" && (
        <p role="alert">{game.error} Use Refresh to try again.</p>
      )}
    </div>
  );
}
export function WalletHint() {
  const { address } = useAccount();
  return !address ? (
    <p className="fine muted">
      You can browse without a wallet. Connect when you’re ready to play.
    </p>
  ) : null;
}
export function UserLink({ address }: { address: Address }) {
  return <WalletAddress address={address} />;
}
