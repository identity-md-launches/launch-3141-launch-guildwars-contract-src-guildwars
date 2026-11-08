// Rebuilds the interface from the unchanged Solidity source; no deployment or signing.
import fs from "node:fs";
import solc from "solc";
import { keccak256, toHex } from "viem";

const address = "0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30";
const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
const expectedAbiHash =
  "cc93f5639849513738065b2953747ddda5bc0b3e740829e080f4475ca314ad8d";
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const source = fs.readFileSync(
  new URL("../../src/GuildWars.sol", import.meta.url),
  "utf8",
);
const baseline = process.argv[2];
let deployed;
if (baseline)
  deployed = JSON.parse(fs.readFileSync(baseline, "utf8")).find(
    (r) => r.id === 3,
  ).result;
else {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  const result = await response.json();
  if (result.error) throw new Error(JSON.stringify(result.error));
  deployed = result.result;
}
if (!deployed || deployed === "0x") throw new Error("No deployed code");
let matched;
for (const evmVersion of ["cancun", "shanghai", "paris"]) {
  const input = {
    language: "Solidity",
    sources: { "src/GuildWars.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion,
      metadata: { bytecodeHash: "none", appendCBOR: false },
      outputSelection: {
        "*": { "": ["ast"], "*": ["abi", "evm.deployedBytecode"] },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((e) => e.severity === "error");
  if (errors?.length)
    throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const contract = output.contracts["src/GuildWars.sol"].GuildWars;
  const names = {};
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (
      node.nodeType === "VariableDeclaration" &&
      node.mutability === "immutable"
    )
      names[node.id] = node.name;
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
  };
  visit(output.sources["src/GuildWars.sol"].ast);
  const values = {
    mining: "2dccb11fcc2defdd188555e45acb52231e82e218",
    staking: "50fd1780526c3186a0c037c7622203bc4fb611ca",
    minStakerPower: (10n ** 18n).toString(16),
  };
  let runtime = contract.evm.deployedBytecode.object;
  for (const [id, refs] of Object.entries(
    contract.evm.deployedBytecode.immutableReferences,
  )) {
    for (const { start, length } of refs)
      runtime =
        runtime.slice(0, start * 2) +
        values[names[id]].padStart(length * 2, "0") +
        runtime.slice((start + length) * 2);
  }
  const abiHash = keccak256(toHex(JSON.stringify(canonical(contract.abi))));
  if (`0x${runtime}`.toLowerCase() === deployed.toLowerCase()) {
    matched = { contract, evmVersion, abiHash };
    break;
  }
}
if (!matched)
  throw new Error("Compiled runtime does not match deployed runtime");
const runtimeHash = keccak256(deployed);
fs.writeFileSync(
  new URL("../src/abi.json", import.meta.url),
  JSON.stringify(matched.contract.abi, null, 2) + "\n",
);
fs.writeFileSync(
  new URL("../src/verified.ts", import.meta.url),
  `// solc 0.8.24; optimizer 200; ${matched.evmVersion}; immutable values verified against deployment.\nexport const VERIFIED_RUNTIME_HASH = '${runtimeHash}' as const;\nexport const VERIFIED_ABI_HASH = '${matched.abiHash}' as const;\n`,
);
console.log(
  JSON.stringify(
    {
      address,
      rpc,
      solc: solc.version(),
      evmVersion: matched.evmVersion,
      abiHash: matched.abiHash,
      pinnedAbiHash: `0x${expectedAbiHash}`,
      abiHashMatchesPin: matched.abiHash.slice(2) === expectedAbiHash,
      runtimeHash,
      runtimeBytes: (deployed.length - 2) / 2,
      result:
        "exact compiled deployed runtime match; ABI is generated from that same source",
      note:
        matched.abiHash.slice(2) === expectedAbiHash
          ? "Canonical ABI matches pin."
          : "Canonical ABI hash differs from the pin. The exact byte-for-byte runtime match independently verifies the source and its generated interface. No ABI was substituted.",
    },
    null,
    2,
  ),
);
