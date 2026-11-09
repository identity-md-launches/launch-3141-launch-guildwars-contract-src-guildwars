import { useMemo, useState } from "react";
import { Hamster } from "./art";
import {
  Countdown,
  Empty,
  GuildName,
  SectionTitle,
  TierBadge,
} from "./components";
import { Icon } from "./icons";
import { TIERS, score, seasonLabel } from "./model";
import { useGame } from "./store";

export function Rankings() {
  const game = useGame();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [largeCrewsOnly, setLargeCrewsOnly] = useState(false);
  const [sort, setSort] = useState("score");
  const guilds = useMemo(
    () =>
      game.guilds
        .filter(
          (g) =>
            g.memberCount > 0 &&
            g.name.toLowerCase().includes(search.toLowerCase()) &&
            (!largeCrewsOnly || g.seasonMembers >= 5) &&
            (tier === "all" || g.tier === Number(tier)),
        )
        .sort((a, b) =>
          sort === "members"
            ? b.memberCount - a.memberCount
            : a.average === b.average
              ? Number(a.id - b.id)
              : a.average > b.average
                ? -1
                : 1,
        ),
    [game.guilds, search, tier, sort, largeCrewsOnly],
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Small paws.
            <br />
            <span>Big rivalries.</span>
          </h1>
          <p>A daily team game for the Squeekchain community.</p>
          <div className="actions">
            <a className="primary" href="#create">
              <Icon name="plus" />
              Create a guild
            </a>
            <a className="secondary" href="#create/join">
              Join a guild
              <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-1" />
          <div className="orbit orbit-2" />
          <span className="art-star star-one">+</span>
          <span className="art-star star-two">+</span>
          <span className="art-star star-three">+</span>
          <div className="hero-hamster left">
            <Hamster id="welcome" name="Future guild" decorative />
          </div>
          <div className="hero-hamster right">
            <Hamster id="rivalry" name="Future rival" decorative />
          </div>
          <div className="hero-rope">
            <span />
          </div>
          <span className="art-caption">A little friendly competition.</span>
        </div>
      </section>
      <div className="season-strip">
        <div>
          <span className="label">Current season</span>
          <strong>
            {game.season === undefined
              ? "Reading…"
              : `Week of ${seasonLabel(game.season)}`}
          </strong>
        </div>
        <div>
          <span className="label">Guilds in play</span>
          <strong>
            {game.block === undefined
              ? "—"
              : game.guilds
                  .filter((g) => g.memberCount > 0)
                  .length.toLocaleString()}
          </strong>
        </div>
        <div className="season-timer">
          <span className="label">Next season in</span>
          <strong>
            <Countdown season={game.season} />
          </strong>
        </div>
        <span className="season-note">
          Resets Monday
          <br />
          00:00 UTC
        </span>
      </div>
      <section className="rankings-section">
        <SectionTitle
          aside={<span className="fine muted">Average points win.</span>}
        >
          Guild rankings
        </SectionTitle>
        <div className="table-controls">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="sr-only">Search guilds</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guilds"
              type="search"
            />
          </label>
          <label className="select-field">
            <span className="sr-only">Filter by tier</span>
            <select
              aria-label="Filter by tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="all">All tiers</option>
              {TIERS.map((name, index) => (
                <option value={index} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="crew-filter">
            <input
              type="checkbox"
              checked={largeCrewsOnly}
              onChange={(e) => setLargeCrewsOnly(e.target.checked)}
            />
            Only guilds with 5+ members
          </label>
          <label className="select-field sort-select">
            <span className="sr-only">Sort guilds</span>
            <select
              aria-label="Sort guilds"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="score">Top score</option>
              <option value="members">Most members</option>
            </select>
          </label>
        </div>
        <div className="card guild-table-wrap">
          <table className="guild-table">
            <caption className="sr-only">
              Guild rankings by season points per member
            </caption>
            <thead>
              <tr>
                <th className="rank-col">#</th>
                <th>Guild</th>
                <th className="tier-col">Tier</th>
                <th className="crew-col">Members</th>
                <th className="score-col">Score / member</th>
              </tr>
            </thead>
            <tbody>
              {guilds.map((guild, index) => (
                <tr key={String(guild.id)}>
                  <td className="muted">{index + 1}</td>
                  <td>
                    <GuildName guild={guild} />
                    <span className="mobile-tier">
                      <TierBadge tier={guild.tier} />
                    </span>
                  </td>
                  <td className="tier-col">
                    <TierBadge tier={guild.tier} />
                  </td>
                  <td className="crew-col">
                    {guild.memberCount}
                    <span className="muted"> / {guild.seats}</span>
                  </td>
                  <td className="score-col">
                    {score(guild.average)}
                    {guild.seasonMembers < 5 && (
                      <span className="small-sample fine muted">
                        small sample
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {game.block === undefined ? (
            <div className="loading-state">
              <span className="spinner" />
              {game.status === "error"
                ? "Rankings could not be loaded. Use Refresh below."
                : "Reading the guild registry…"}
            </div>
          ) : guilds.length === 0 ? (
            search || tier !== "all" || largeCrewsOnly ? (
              <Empty title="No matching guilds" action={false} art={false}>
                Try a different name or{" "}
                <button
                  className="inline-button"
                  onClick={() => {
                    setSearch("");
                    setTier("all");
                    setLargeCrewsOnly(false);
                  }}
                >
                  clear filters
                </button>
                .
              </Empty>
            ) : (
              <Empty title="No guild yet. Be the first to create one.">
                Every rivalry starts with a team.
              </Empty>
            )
          ) : null}
        </div>
        <p className="table-note fine muted">
          Averages favour small crews: check the member count before comparing
          guilds.
        </p>
        <p className="table-note fine muted">
          Scores come from the GuildWars contract. Members who leave take their
          current-season points with them.
        </p>
      </section>
      <div className="quick-rules">
        <div>
          <span className="rule-number">01</span>
          <div>
            <h3>Find your crew</h3>
            <p>5–20 seats. One guild per wallet.</p>
          </div>
        </div>
        <div>
          <span className="rule-number">02</span>
          <div>
            <h3>Show up daily</h3>
            <p>10 base points. Up to 25 with bonuses.</p>
          </div>
        </div>
        <div>
          <span className="rule-number">03</span>
          <div>
            <h3>Pull together</h3>
            <p>The highest average takes the war.</p>
          </div>
        </div>
      </div>
    </>
  );
}
