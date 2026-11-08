import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CONTRACT, EXPLORER } from "./chain";
import { ReadStatus } from "./components";
import { Icon, type IconName } from "./icons";
import { Rankings } from "./Rankings";
import { CreateJoin } from "./CreateJoin";
import { MyGuild } from "./MyGuild";
import { WarPage } from "./War";
import { Profile, Recruiting, Trophies } from "./Community";
import { Rules } from "./Rules";
import { setConnected, startStore } from "./store";
import { Transactions } from "./Transactions";
import { WalletControl } from "./Wallet";

const NAV: { id: string; label: string; icon: IconName }[] = [
  { id: "rankings", label: "Rankings", icon: "rank" },
  { id: "my-guild", label: "My guild", icon: "guild" },
  { id: "war", label: "War", icon: "war" },
  { id: "recruiting", label: "Recruiting", icon: "recruit" },
  { id: "trophies", label: "Trophies", icon: "trophy" },
  { id: "create", label: "Create / Join", icon: "plus" },
  { id: "rules", label: "Rules", icon: "rules" },
];
export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "rankings");
  const { address } = useAccount();
  useEffect(startStore, []);
  useEffect(() => {
    setConnected(address);
  }, [address]);
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(1) || "rankings");
      window.scrollTo({ top: 0 });
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>("main")
          ?.focus({ preventScroll: true }),
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [page, parameter] = route.split("/");
  const active =
    page === "guild" ? "my-guild" : page === "profile" ? "recruiting" : page;
  let content;
  if (page === "my-guild") content = <MyGuild />;
  else if (page === "guild" && /^\d+$/.test(parameter ?? ""))
    content = <MyGuild guildId={BigInt(parameter)} />;
  else if (page === "war") content = <WarPage />;
  else if (page === "recruiting") content = <Recruiting />;
  else if (page === "trophies") content = <Trophies />;
  else if (page === "profile") content = <Profile wallet={parameter ?? ""} />;
  else if (page === "create")
    content = <CreateJoin key={route} joinFirst={parameter === "join"} />;
  else if (page === "rules") content = <Rules />;
  else content = <Rankings />;
  return (
    <Transactions>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            href="#rankings"
            className="brand"
            aria-label="Squeek Guild Wars home"
          >
            <svg
              width="38"
              height="38"
              viewBox="0 0 40 40"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 18C2 8 15 4 16 13m8 0c2-10 14-5 8 5M7 22c0-8 26-8 26 0v6c-1 10-25 10-26 0Z"
                stroke="#c9a5ff"
                strokeWidth="2"
              />
              <circle cx="14" cy="24" r="2" fill="#c9a5ff" />
              <circle cx="26" cy="24" r="2" fill="#c9a5ff" />
              <path d="M18 29h4l-2 3Z" fill="#c9a5ff" />
            </svg>
            <span>
              SQUEEK<span>GUILD WARS</span>
            </span>
          </a>
          <div className="header-utilities">
            <span className="network-badge">
              <span />
              Sepolia
            </span>
            <WalletControl />
          </div>
        </div>
      </header>
      <div className="nav-container">
        <nav className="main-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <a
              href={`#${item.id}`}
              key={item.id}
              aria-current={active === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
      <main id="main-content" className="main-content" tabIndex={-1} key={page}>
        {content}
        <ReadStatus />
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">Small paws. Same team.</span>
          <p>Unofficial community project; no tokens, no payouts.</p>
        </div>
        <a
          href={`${EXPLORER}/address/${CONTRACT}`}
          target="_blank"
          rel="noreferrer"
        >
          View GuildWars contract <Icon name="external" size={14} />
        </a>
        <span className="fine muted">Built for the Squeekchain community.</span>
      </footer>
    </Transactions>
  );
}
