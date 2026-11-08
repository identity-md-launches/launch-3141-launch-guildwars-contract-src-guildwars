import { CONTRACT, EXPLORER, READ_RPC } from "./chain";
import { SectionTitle } from "./components";
import { useGame } from "./store";

const rules = [
  {
    title: "Make a guild",
    text: "Guilds have 5 to 20 seats. A wallet belongs to one guild at a time. Names use 1–24 letters, numbers, spaces, or hyphens. Your name and seat count are permanent.",
  },
  {
    title: "Check in once a UTC day",
    text: "A check-in earns 10 base points. Your next check-in opens at 00:00 UTC. Consecutive days build a streak; missing a day resets it on the next check-in.",
  },
  {
    title: "Understand the bonuses",
    text: "You earn ×2 if a SqueekMining round was settled since your previous check-in; the contract detects an advanced round and needs a previous known round. You earn ×1.25 for eligible SQK staking power at or above the contract threshold. Fresh stake is excluded while its freshness round is ahead. Points round down: 10, 12, 20, or 25. The maximum is 25. If a dependency read fails, that bonus is skipped and the check-in can still succeed.",
  },
  {
    title: "Average beats size",
    text: "A guild score is the sum of its members’ season points divided by its season member count, stored at a 1,000,000 scale. Members who leave or are removed take their current-season points out of the guild score. Past seasons retain their snapshots.",
  },
  {
    title: "New week, new season",
    text: "Seasons run from Monday 00:00 UTC to the following Monday. The countdown follows UTC. A guild’s tier is snapshotted at its first activity of the season.",
  },
  {
    title: "Settle a war",
    text: "After a season ends, a captain submits a war between two different guilds. Both must have checked in that season, share the same season tier, and have no settled war for that season. The higher per-member average wins +300 tier points, the loser gets +0 and loses nothing. A tie gives +150 to each.",
  },
  {
    title: "Climb without losing points",
    text: "Bronze starts at 0 tier points, Silver at 1,000, Gold at 3,000, and Legend at 6,000. Tier points, trophies, emblems, and titles are cosmetic only. Streak milestones are 7, 30, and 100 days.",
  },
  {
    title: "Leaving and inactivity",
    text: "Leaving starts a 24-hour cool-down before you can join or create another guild. A captain must transfer their role before leaving if other members remain. Anyone may remove a non-captain member inactive for 14 days, measured from their last check-in or join day. A member may claim captain after 14 days of captain inactivity. Removal does not apply the leave cool-down.",
  },
  {
    title: "Invite codes are shared, not private",
    text: "The app generates a random invite code and sends only its keccak256 hash when you create a guild or rotate the code. Save it when confirmation shows it once. Joining publishes the code in transaction calldata. Captains can close recruiting, rotate codes, or remove members.",
  },
  {
    title: "Know how pairings work",
    text: "A captain chooses a same-tier opponent and settles both guilds’ single war for that season. The other captain cannot refuse the pairing. Cooperative guilds can farm cosmetic tier points; many-wallet participation is not prevented. There is no automatic matchmaking or bye award.",
  },
];
export function Rules() {
  const game = useGame();
  return (
    <>
      <div className="page-title">
        <h1>Small game. Clear rules.</h1>
        <p>Unofficial community project; no tokens, no payouts.</p>
      </div>
      <div className="rules-layout">
        <section className="card rules-list">
          {rules.map((rule, index) => (
            <div className="rule-detail" key={rule.title}>
              <span className="rule-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{rule.title}</h2>
                <p>{rule.text}</p>
              </div>
            </div>
          ))}
        </section>
        <aside className="rules-aside">
          <SectionTitle>On-chain, out in the open</SectionTitle>
          <p className="muted">
            GuildWars holds no funds and has no owner, admin, pause, or proxy.
            The game never asks for a key, seed phrase, token approval, or game
            payment. Your wallet pays Sepolia network gas for transactions.
          </p>
          <dl className="contract-facts">
            <dt>Network</dt>
            <dd>Ethereum Sepolia · 11155111</dd>
            <dt>GuildWars contract</dt>
            <dd>
              <a
                className="address"
                target="_blank"
                rel="noreferrer"
                href={`${EXPLORER}/address/${CONTRACT}`}
              >
                {CONTRACT}
              </a>
            </dd>
            <dt>History starts at block</dt>
            <dd>12,089,806</dd>
            <dt>Public read RPC</dt>
            <dd>
              <a
                className="address"
                target="_blank"
                rel="noreferrer"
                href={READ_RPC}
              >
                {READ_RPC}
              </a>
            </dd>
            <dt>Staker power threshold</dt>
            <dd>
              {game.minPower?.toString() ?? "Reading…"}
              <span className="fine muted">Raw SQK staking-power units</span>
            </dd>
          </dl>
          <p className="fine muted">
            The site rebuilds public history from contract events in chunks,
            keeps it in memory, and refreshes every 30 seconds while visible. No
            indexer or server database is used. Reloading rebuilds the cache.
          </p>
          <p className="fine muted">
            Before each signature, you see the action in plain words. It is
            simulated through the public RPC with your address before your
            wallet is asked to send.
          </p>
        </aside>
      </div>
    </>
  );
}
