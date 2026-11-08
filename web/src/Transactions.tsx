import { createContext, useContext, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { toHex, type Hash } from "viem";
import {
  CHAIN_ID,
  CONTRACT,
  EXPLORER,
  friendlyError,
  publicClient,
  simulate,
  transactionData,
  verifyDeployment,
} from "./chain";
import { refresh } from "./store";
import { Dialog, openWallet } from "./Wallet";
import { Icon } from "./icons";

export type Action = {
  name: string;
  args: readonly unknown[];
  title: string;
  explanation: string;
  code?: string;
};
type TxContext = { act: (action: Action) => void; busy: boolean };
const Context = createContext<TxContext>({ act: () => {}, busy: false });
export const useTransaction = () => useContext(Context);
export function Transactions({ children }: { children: React.ReactNode }) {
  const { address, chainId, connector } = useAccount();
  const [action, setAction] = useState<Action>();
  const [stage, setStage] = useState<
    "review" | "simulating" | "wallet" | "mining" | "success" | "error"
  >("review");
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const busy = ["simulating", "wallet", "mining"].includes(stage);
  const act = (next: Action) => {
    if (lock.current || action) return;
    setAction(next);
    setStage("review");
    setMessage("");
    setHash(undefined);
    setCopied(false);
  };
  const close = () => {
    if (!lock.current) {
      setAction(undefined);
      setHash(undefined);
    }
  };
  async function trackReceipt(txHash: Hash) {
    setStage("mining");
    setMessage("Transaction sent. Waiting for a Sepolia receipt.");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });
    if (receipt.status !== "success")
      throw new Error(
        "The transaction reverted on Sepolia. No game changes were saved.",
      );
    setStage("success");
    setMessage("Confirmed on Sepolia.");
    void refresh();
  }
  async function send() {
    if (
      lock.current ||
      !action ||
      !address ||
      !connector ||
      chainId !== CHAIN_ID
    )
      return;
    lock.current = true;
    setMessage("");
    let sent: Hash | undefined = hash;
    try {
      if (sent) {
        await trackReceipt(sent);
        return;
      }
      setStage("simulating");
      setMessage("Checking this action with the public Sepolia RPC…");
      await verifyDeployment();
      await simulate(action.name, action.args, address);
      const data = transactionData(action.name, action.args);
      const gas = await publicClient.estimateGas({
        account: address,
        to: CONTRACT,
        data,
        value: 0n,
      });
      const wallet = (await connector.getProvider()) as {
        request: (args: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      };
      const actualChain = await wallet.request({ method: "eth_chainId" });
      const actualAccounts = (await wallet.request({
        method: "eth_accounts",
      })) as string[];
      if (Number(actualChain) !== CHAIN_ID) throw new Error("Wrong network");
      if (actualAccounts[0]?.toLowerCase() !== address.toLowerCase())
        throw new Error(
          "The selected wallet account changed. Close this review and try again.",
        );
      setStage("wallet");
      setMessage("Review and approve the transaction in your wallet.");
      sent = (await wallet.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: CONTRACT,
            data,
            value: "0x0",
            gas: toHex((gas * 120n) / 100n),
            chainId: toHex(CHAIN_ID),
          },
        ],
      })) as Hash;
      setHash(sent);
      await trackReceipt(sent);
    } catch (error) {
      setStage("error");
      setMessage(
        sent
          ? error instanceof Error &&
            error.message.includes("transaction reverted")
            ? "The transaction reverted on Sepolia. No game changes were saved. View its receipt below."
            : "This transaction has already been sent. Check its receipt below or retry the receipt check. Do not submit it again."
          : friendlyError(error),
      );
    } finally {
      lock.current = false;
    }
  }
  return (
    <Context.Provider value={{ act, busy }}>
      {children}
      {action && (
        <Dialog
          title={stage === "success" ? "Action confirmed" : action.title}
          busy={busy}
          onClose={close}
        >
          <p>{action.explanation}</p>
          <dl className="tx-details">
            <div>
              <dt>Network</dt>
              <dd>Ethereum Sepolia</dd>
            </div>
            <div>
              <dt>Game payment</dt>
              <dd>None · network gas only</dd>
            </div>
          </dl>
          <p className="fine muted">Contract</p>
          <a
            className="address fine"
            href={`${EXPLORER}/address/${CONTRACT}`}
            target="_blank"
            rel="noreferrer"
          >
            {CONTRACT}
          </a>
          <p
            className={stage === "error" ? "error" : "tx-status"}
            role={stage === "error" ? "alert" : "status"}
          >
            {message}
          </p>
          {hash && (
            <a
              className="text-link"
              href={`${EXPLORER}/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction <Icon name="external" size={14} />
            </a>
          )}
          {stage === "success" && action.code && (
            <div className="secret-box">
              <h3>Save your invite code</h3>
              <p>
                This code is shown once. It is not saved in your browser. Share
                it with your guild, and rotate it if needed.
              </p>
              <code>{action.code}</code>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(action.code!);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                    setMessage(
                      "Copy is unavailable. Select the code below to save it.",
                    );
                  }
                }}
              >
                <Icon name="copy" />
                {copied ? "Copied" : "Copy code"}
              </button>
              <p className="fine muted">
                A join publishes this code in transaction calldata.
              </p>
            </div>
          )}
          <div className="actions">
            {stage === "success" ? (
              <button className="primary" onClick={close}>
                <Icon name="check" />
                Done
              </button>
            ) : !address ? (
              <button
                className="primary"
                onClick={() => {
                  close();
                  openWallet();
                }}
              >
                Connect wallet
              </button>
            ) : chainId !== CHAIN_ID ? (
              <p className="notice">
                Use “Switch to Sepolia” in the wallet control before continuing.
              </p>
            ) : (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void send()}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    {stage === "simulating"
                      ? "Simulating…"
                      : stage === "wallet"
                        ? "Waiting for wallet…"
                        : "Confirming…"}
                  </>
                ) : hash ? (
                  "Check receipt"
                ) : (
                  "Simulate & continue"
                )}
              </button>
            )}
            {stage !== "success" && (
              <button className="secondary" disabled={busy} onClick={close}>
                Cancel
              </button>
            )}
          </div>
        </Dialog>
      )}
    </Context.Provider>
  );
}
