import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import type { Connector } from "wagmi";
import { CHAIN_ID, friendlyError } from "./chain";
import { short } from "./model";
import { Icon } from "./icons";

export function Dialog({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

const coinbaseIcon =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#2C5FF6"/><circle cx="14" cy="14" r="10" fill="white"/><rect x="10" y="10" width="8" height="8" rx="1" fill="#2C5FF6"/></svg>',
  );
const mobileWallets = [
  {
    name: "MetaMask",
    icon: "./wallets/metamask.svg",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    name: "Coinbase Wallet",
    icon: coinbaseIcon,
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    name: "Rabby",
    icon: "./wallets/rabby.svg",
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    name: "Phantom",
    icon: "./wallets/phantom.svg",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
export function openWallet() {
  window.dispatchEvent(new Event("squeek:connect"));
}

export function WalletControl() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const lock = useRef(false);
  const hasInjectedProvider =
    Boolean((window as unknown as { ethereum?: unknown }).ethereum) ||
    connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const phone =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !hasInjectedProvider;
  useEffect(() => {
    const fn = () => {
      setError("");
      setOpen(true);
    };
    window.addEventListener("squeek:connect", fn);
    return () => window.removeEventListener("squeek:connect", fn);
  }, []);
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ]
    .filter((c) => !(c.id === "injected" && named))
    .filter((c) => !phone || c.type !== "injected");
  async function connectWallet(connector: Connector) {
    if (lock.current) return;
    lock.current = true;
    setLocked(true);
    setPendingId(connector.uid);
    setError("");
    try {
      await connectAsync({ connector });
      setOpen(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setLocked(false);
      setPendingId(undefined);
    }
  }
  async function switchNetwork() {
    if (lock.current) return;
    lock.current = true;
    setLocked(true);
    setError("");
    try {
      await switchChainAsync({ chainId: CHAIN_ID });
    } catch (e) {
      setError(friendlyError(e));
      setOpen(true);
    } finally {
      lock.current = false;
      setLocked(false);
    }
  }
  return (
    <>
      <button
        className="wallet-control secondary"
        onClick={() =>
          isConnected && chainId !== CHAIN_ID
            ? void switchNetwork()
            : setOpen(true)
        }
        disabled={locked || switching}
      >
        <Icon name="wallet" />
        <span>
          {switching
            ? "Switching…"
            : address
              ? chainId !== CHAIN_ID
                ? "Switch to Sepolia"
                : short(address)
              : "Connect wallet"}
        </span>
      </button>
      {open && (
        <Dialog
          title={isConnected ? "Wallet connected" : "Connect a wallet"}
          onClose={() => setOpen(false)}
        >
          <p className="muted">
            Connect to join a guild or check in. You will approve each action
            separately.
          </p>
          {isConnected && address ? (
            <>
              <p className="address">{address}</p>
              <p>
                {chainId === CHAIN_ID
                  ? "Ethereum Sepolia"
                  : "Your wallet is on another network."}
              </p>
              <div className="actions">
                {chainId !== CHAIN_ID && (
                  <button
                    className="primary"
                    onClick={() => void switchNetwork()}
                    disabled={locked}
                  >
                    Switch to Sepolia
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                >
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <div className="wallet-list">
              {phone &&
                mobileWallets.map((wallet) => (
                  <a
                    className="wallet-row"
                    href={wallet.href(location.href)}
                    key={wallet.name}
                  >
                    <img src={wallet.icon} alt="" width="28" height="28" />
                    Open in {wallet.name}
                    <Icon name="external" />
                  </a>
                ))}
              {listed.map((connector) => (
                <button
                  className="wallet-row"
                  key={connector.uid}
                  disabled={isPending || locked}
                  onClick={() => void connectWallet(connector)}
                >
                  {connector.icon || connector.id === "coinbaseWalletSDK" ? (
                    <img
                      width="28"
                      height="28"
                      alt=""
                      src={connector.icon ?? coinbaseIcon}
                    />
                  ) : (
                    <Icon name="wallet" size={28} />
                  )}
                  <span>
                    {connector.id === "injected"
                      ? "Browser wallet"
                      : connector.id === "coinbaseWalletSDK"
                        ? phone
                          ? "Coinbase Smart Wallet"
                          : "Coinbase Wallet"
                        : connector.name}
                    {pendingId === connector.uid ? " · opening…" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="fine muted">
            Never enter a private key or seed phrase. On phones, open this page
            in your wallet’s browser.
          </p>
        </Dialog>
      )}
    </>
  );
}
