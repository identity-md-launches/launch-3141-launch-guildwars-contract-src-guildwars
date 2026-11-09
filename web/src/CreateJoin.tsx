import { useState } from "react";
import { useAccount } from "wagmi";
import { keccak256, toHex } from "viem";
import { CHAIN_ID } from "./chain";
import { Hamster } from "./art";
import { SectionTitle, WalletHint } from "./components";
import { Icon } from "./icons";
import { useGame } from "./store";
import { matchingGuildIds } from "./model";
import { useTransaction } from "./Transactions";
import { openWallet } from "./Wallet";

export function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `MR-${[...crypto.getRandomValues(new Uint8Array(6))].map((b) => alphabet[b % 32]).join("")}`;
}
export function CreateJoin({ joinFirst = false }: { joinFirst?: boolean }) {
  const [tab, setTab] = useState(joinFirst ? "join" : "create");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("10");
  const [guildId, setGuildId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const { address, chainId } = useAccount();
  const { act, busy } = useTransaction();
  const game = useGame();
  const matchingIds = matchingGuildIds(game.events, name);
  const duplicateWarning = matchingIds.length
    ? `A guild named like this already exists (${matchingIds.map((id) => `#${id}`).join(", ")}). Players will tell yours apart by its ID.`
    : "";
  const member = game.people.find(
    (p) => p.address.toLowerCase() === address?.toLowerCase(),
  );
  const cooling = member && Number(member.cooldownUntil) * 1000 > Date.now();
  const locked =
    busy ||
    Boolean(address && chainId !== CHAIN_ID) ||
    !game.verified ||
    game.status !== "ready" ||
    Boolean(member?.guildId) ||
    Boolean(cooling);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setErrorField("");
    if (!address) {
      openWallet();
      return;
    }
    if (tab === "create") {
      if (!/^[A-Za-z0-9 -]{1,24}$/.test(name.trim())) {
        setErrorField("name");
        setError(
          "Choose 1–24 characters: letters, numbers, spaces, or hyphens.",
        );
        document.getElementById("guild-name")?.focus();
        return;
      }
      if (
        !Number.isInteger(Number(seats)) ||
        Number(seats) < 5 ||
        Number(seats) > 20
      ) {
        setErrorField("seats");
        setError("Choose a whole number of seats from 5 to 20.");
        document.getElementById("guild-seats")?.focus();
        return;
      }
      const secret = inviteCode();
      act({
        name: "createGuild",
        args: [name.trim(), Number(seats), keccak256(toHex(secret))],
        title: "Create this guild?",
        explanation: `${duplicateWarning ? `${duplicateWarning} ` : ""}Create “${name.trim()}” with ${seats} seats on Sepolia. You become its captain and first member. Your guild receives its own ID when created. Only the hash of a random invite code is stored. Save the code when this transaction confirms.`,
        code: secret,
      });
    } else {
      if (!/^\d+$/.test(guildId) || BigInt(guildId) < 1n) {
        setErrorField("id");
        setError("Enter the guild’s positive numeric ID.");
        document.getElementById("join-id")?.focus();
        return;
      }
      if (!code.trim()) {
        setErrorField("code");
        setError("Enter the current invite code from the captain.");
        document.getElementById("join-code")?.focus();
        return;
      }
      act({
        name: "join",
        args: [BigInt(guildId), code.trim()],
        title: "Join this guild?",
        explanation: `Join guild #${guildId} with the invite code you entered. This makes your wallet a public member. Your invite code will be visible in the join transaction. Leaving afterwards starts a 24-hour cool-down.`,
      });
    }
  };
  return (
    <>
      <div className="page-title">
        <h1>Find your people.</h1>
        <p>Start a guild, or take your seat in one.</p>
      </div>
      <div className="create-layout">
        <section className="card form-panel">
          <div className="segmented" role="group" aria-label="Create or join">
            <button
              aria-pressed={tab === "create"}
              onClick={() => {
                setTab("create");
                setError("");
              }}
            >
              Create a guild
            </button>
            <button
              aria-pressed={tab === "join"}
              onClick={() => {
                setTab("join");
                setError("");
              }}
            >
              Join a guild
            </button>
          </div>
          <form onSubmit={submit} noValidate>
            {tab === "create" ? (
              <>
                <label htmlFor="guild-name">Guild name</label>
                <input
                  id="guild-name"
                  name="guildName"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  placeholder="e.g. Midnight Runners"
                  aria-describedby="name-hint name-warning form-error"
                  aria-invalid={Boolean(error) && errorField === "name"}
                />
                <p className="field-hint" id="name-hint">
                  1–24 characters: letters, numbers, spaces, hyphens.
                </p>
                <p className="name-warning" id="name-warning" role="status">
                  {duplicateWarning}
                </p>
                <label htmlFor="guild-seats">Seats</label>
                <input
                  id="guild-seats"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={20}
                  step={1}
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                  aria-describedby="seats-hint form-error"
                  aria-invalid={Boolean(error) && errorField === "seats"}
                />
                <p className="field-hint" id="seats-hint">
                  5–20 members, including you. Capacity cannot be changed.
                </p>
                <div className="form-notice">
                  <Icon name="rules" />
                  <p>
                    A random invite code is created for you. You’ll see it once,
                    after confirmation.
                  </p>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="join-id">Guild ID</label>
                <input
                  id="join-id"
                  inputMode="numeric"
                  autoComplete="off"
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                  placeholder="e.g. 1"
                  aria-describedby="form-error"
                  aria-invalid={Boolean(error) && errorField === "id"}
                />
                <label htmlFor="join-code">Invite code</label>
                <input
                  id="join-code"
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ask the captain"
                  aria-describedby="code-hint form-error"
                  aria-invalid={Boolean(error) && errorField === "code"}
                />
                <p className="field-hint" id="code-hint">
                  Codes are case-sensitive and become public once used to join.
                </p>
                <a className="text-link" href="#recruiting">
                  Find a recruiting guild
                  <Icon name="arrow" size={16} />
                </a>
              </>
            )}
            <p id="form-error" className="error" role="alert">
              {error}
            </p>
            {Boolean(member?.guildId) && (
              <p className="notice">
                You’re already in a guild. <a href="#my-guild">Open My guild</a>
                .
              </p>
            )}
            {cooling && (
              <p className="notice">
                Your leave cool-down ends{" "}
                {new Date(Number(member.cooldownUntil) * 1000).toUTCString()}.
              </p>
            )}
            {address && chainId !== CHAIN_ID && (
              <p className="notice">
                Switch your wallet to Sepolia using the header control.
              </p>
            )}
            <button type="submit" className="primary full" disabled={locked}>
              <Icon name={tab === "create" ? "plus" : "guild"} />
              {address
                ? tab === "create"
                  ? "Review guild creation"
                  : "Review joining"
                : tab === "create"
                  ? "Connect to create"
                  : "Connect to join"}
            </button>
            <WalletHint />
          </form>
        </section>
        <aside className="create-aside">
          <div className="identity-preview">
            <Hamster id="preview" name={name.trim() || "Your guild"} />
            <span className="label">{name.trim() || "Your future guild"}</span>
          </div>
          <SectionTitle>A face for your guild</SectionTitle>
          <p className="muted">
            Your guild’s hamster is generated from its on-chain ID and name.
            Fur, eyes, and accessories make it yours.
          </p>
          <p className="fine muted">
            This is a style preview. Your final hamster appears after your guild
            receives an ID.
          </p>
          <a className="text-link" href="#rules">
            Read the game rules
            <Icon name="arrow" size={16} />
          </a>
        </aside>
      </div>
    </>
  );
}
