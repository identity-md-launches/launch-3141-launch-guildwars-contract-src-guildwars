import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import {
  createPublicClient,
  defineChain,
  type Abi,
  type Address,
  encodeFunctionData,
  decodeFunctionResult,
  keccak256,
} from "viem";
import rawAbi from "./abi.json";
import { VERIFIED_RUNTIME_HASH } from "./verified";

export const CONTRACT: Address = "0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30";
export const START_BLOCK = 12089806n;
export const READ_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const EXPLORER = "https://sepolia.etherscan.io";
export const CHAIN_ID = 11155111;
export const chain = defineChain({
  id: CHAIN_ID,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [READ_RPC] } },
  blockExplorers: { default: { name: "Etherscan", url: EXPLORER } },
  testnet: true,
});
export const abi = rawAbi as Abi;
export const publicClient = createPublicClient({
  chain,
  transport: http(READ_RPC, { timeout: 20_000, retryCount: 1 }),
});
export const config = createConfig({
  chains: [chain],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "Squeek Guild Wars",
      preference: { options: "all" },
    }),
  ],
  transports: { [chain.id]: http(READ_RPC) },
});
export async function retryMissingBlock<T>(
  request: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (
        attempt >= 2 ||
        !/block not found|header not found/i.test(String(error))
      )
        throw error;
    }
  }
}
export const read = async (
  functionName: string,
  args: readonly unknown[] = [],
  blockNumber?: bigint,
) =>
  retryMissingBlock(() =>
    publicClient.readContract({
      address: CONTRACT,
      abi,
      functionName,
      args,
      blockNumber,
    }),
  );

export async function verifyDeployment(blockNumber?: bigint) {
  if ((await publicClient.getChainId()) !== CHAIN_ID)
    throw new Error(
      "The public read endpoint is not on Sepolia. Transactions are disabled.",
    );
  const code = await retryMissingBlock(() =>
    publicClient.getCode({ address: CONTRACT, blockNumber }),
  );
  if (!code || keccak256(code) !== VERIFIED_RUNTIME_HASH)
    throw new Error("Contract verification failed. Transactions are disabled.");
}

export function transactionData(name: string, args: readonly unknown[]) {
  return encodeFunctionData({ abi, functionName: name, args });
}
export async function simulate(
  name: string,
  args: readonly unknown[],
  account: Address,
) {
  const data = transactionData(name, args);
  const result = await publicClient.call({ account, to: CONTRACT, data });
  return name === "checkIn" && result.data
    ? Number(
        decodeFunctionResult({ abi, functionName: name, data: result.data }),
      )
    : undefined;
}

export function friendlyError(error: unknown): string {
  const err = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: unknown;
  };
  const message = [
    typeof err?.code === "number" ? String(err.code) : undefined,
    err?.shortMessage,
    err?.message,
    (err?.cause as { message?: string })?.message,
  ]
    .filter(Boolean)
    .join(" ");
  const known: [RegExp, string][] = [
    [
      /block not found|header not found|missing trie/i,
      "The public Sepolia RPC is catching up to this block. Use Refresh to try again.",
    ],
    [
      /4001|rejected|denied/i,
      "You declined the wallet request. Nothing was sent. You can try again.",
    ],
    [
      /-32002|already pending/i,
      "A request is already open in your wallet. Finish or dismiss it there.",
    ],
    [
      /cool-down/i,
      "Your 24-hour leave cool-down is still active. Wait until it ends before joining or creating a guild.",
    ],
    [
      /already checked in today/i,
      "You already checked in today. Come back after 00:00 UTC.",
    ],
    [/guild full/i, "That guild is full. Choose a guild with an open seat."],
    [
      /wrong code/i,
      "That invite code did not match. Ask the captain for the current code.",
    ],
    [
      /not recruiting/i,
      "That guild has closed recruiting. Ask the captain to reopen it.",
    ],
    [
      /transfer captain first/i,
      "Transfer the captain role to another member before leaving.",
    ],
    [
      /already in a guild/i,
      "You are already in a guild. Leave it before joining another.",
    ],
    [/not in a guild/i, "Join or create a guild before checking in."],
    [
      /not a captain|not captain/i,
      "Only the captain can do this. Connect the captain’s wallet.",
    ],
    [
      /still active|captain active/i,
      "The 14-day inactivity period has not passed yet.",
    ],
    [/not a member/i, "Choose a current member of your guild."],
    [/same guild/i, "Choose two different guilds."],
    [
      /season not over/i,
      "This season is still running. Submit the war after Monday 00:00 UTC.",
    ],
    [
      /tier mismatch/i,
      "These guilds were in different tiers that season. Choose a same-tier opponent.",
    ],
    [
      /already settled/i,
      "A guild in this pairing has already settled its war for that season.",
    ],
    [
      /guild inactive that season/i,
      "Both guilds need a check-in in the selected season.",
    ],
    [
      /insufficient funds/i,
      "Your wallet needs Sepolia ETH for the network gas fee. The game receives no funds.",
    ],
    [/chain|network/i, "Switch your wallet to Ethereum Sepolia and try again."],
    [
      /timeout|fetch|HTTP|429|503/i,
      "The public Sepolia RPC is unavailable. Check your connection and retry.",
    ],
  ];
  return (
    known.find(([pattern]) => pattern.test(message))?.[1] ??
    (message
      ? `Unable to complete this action. ${message.slice(0, 220)}`
      : "Unable to complete this action. Check your connection and retry.")
  );
}
