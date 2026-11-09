import { keccak256, toHex } from "viem";
import { guildLabel, type Guild } from "./model";

const PALETTES = [
  ["#c8a479", "#edd9ba", "#876445"],
  ["#aaa2c7", "#e2ddf2", "#72678f"],
  ["#d9a58c", "#f5d9c6", "#ab745d"],
  ["#9daea8", "#dce7df", "#637e73"],
  ["#c6becf", "#f0ebf4", "#8e819b"],
  ["#caab6c", "#f3e0b6", "#91723c"],
  ["#9eb7ce", "#dceaf6", "#5b7e9c"],
  ["#b5a4a0", "#e7d9d5", "#7a6460"],
];
export function hamsterTraits(id: bigint | string, name: string) {
  const hash = keccak256(toHex(`${id}:${name}`));
  const bytes = hash
    .slice(2)
    .match(/../g)!
    .map((b) => parseInt(b, 16));
  return {
    palette: bytes[0] % PALETTES.length,
    eyes: bytes[1] % 3,
    accessory: bytes[2] % 5,
  };
}

export function hamsterMarkup(id: bigint | string, name: string) {
  const traits = hamsterTraits(id, name);
  const [fur, belly, shade] = PALETTES[traits.palette];
  const eyes =
    traits.eyes === 0
      ? '<ellipse cx="69" cy="81" rx="4.5" ry="6" fill="#17131f"/><ellipse cx="107" cy="81" rx="4.5" ry="6" fill="#17131f"/><circle cx="70" cy="79" r="1.4" fill="#fff"/><circle cx="108" cy="79" r="1.4" fill="#fff"/>'
      : traits.eyes === 1
        ? '<path d="M64 83q5-9 10 0m28 0q5-9 10 0" fill="none" stroke="#211a28" stroke-width="4" stroke-linecap="round"/>'
        : '<circle cx="69" cy="81" r="5" fill="#211a28"/><path d="M101 82l10-3" stroke="#211a28" stroke-width="4" stroke-linecap="round"/>';
  const accessory = [
    "",
    '<path d="M42 65q47-15 93 0l-1 10q-47-14-91 0Z" fill="#a259ff"/><path d="M132 69l15 14-15-4 5 14-15-19Z" fill="#c9a5ff"/>',
    '<path d="M64 55L88 7l25 48Z" fill="#a259ff" stroke="#c9a5ff" stroke-width="2"/><path d="M78 29l23 5M70 45l38 5" stroke="#edd9ba" stroke-width="5"/><circle cx="88" cy="9" r="6" fill="#f3e0b6"/>',
    '<path d="M55 111l33 19 33-19-17 32-16-8-17 8Z" fill="#a259ff"/><path d="M61 118l26 12 28-13" fill="none" stroke="#c9a5ff" stroke-width="2"/>',
    '<path d="M61 56L54 28l22 14L88 19l13 23 22-14-7 28Z" fill="#e3bd70" stroke="#f5d9a1" stroke-width="2"/><circle cx="88" cy="46" r="4" fill="#a259ff"/>',
  ][traits.accessory];
  return `<ellipse cx="88" cy="160" rx="57" ry="7" fill="#000" opacity=".35"/>
    <ellipse cx="55" cy="47" rx="20" ry="22" fill="${shade}"/><ellipse cx="55" cy="47" rx="12" ry="14" fill="#d49c9e"/>
    <ellipse cx="122" cy="47" rx="20" ry="22" fill="${shade}"/><ellipse cx="122" cy="47" rx="12" ry="14" fill="#d49c9e"/>
    <path d="M38 88C33 54 56 44 88 44s56 11 51 45c16 13 19 36 5 51-15 19-96 19-112 0-14-16-10-37 6-52Z" fill="${fur}" stroke="${shade}" stroke-width="2"/>
    <ellipse cx="88" cy="120" rx="37" ry="33" fill="${belly}"/><ellipse cx="56" cy="99" rx="16" ry="13" fill="${belly}"/><ellipse cx="120" cy="99" rx="16" ry="13" fill="${belly}"/>
    ${eyes}<ellipse cx="52" cy="97" rx="7" ry="4" fill="#d49c9e" opacity=".65"/><ellipse cx="124" cy="97" rx="7" ry="4" fill="#d49c9e" opacity=".65"/>
    <path d="M82 94q6-5 12 0l-6 6Z" fill="#88565d"/><path d="M88 100v5m0 0q-5 6-10 0m10 0q5 6 10 0" fill="none" stroke="#65464d" stroke-width="2" stroke-linecap="round"/>
    <path d="M37 119q-13-4-12 7t19 4m97-11q13-4 12 7t-19 4" fill="${belly}" stroke="${shade}" stroke-width="2"/>
    <ellipse cx="58" cy="151" rx="17" ry="8" fill="${shade}"/><ellipse cx="118" cy="151" rx="17" ry="8" fill="${shade}"/>
    ${accessory}`;
}

export function Hamster({
  id,
  name,
  className = "",
  decorative = false,
}: {
  id: bigint | string;
  name: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      className={`hamster ${className}`}
      viewBox="0 0 176 176"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={
        decorative
          ? undefined
          : `${name}${typeof id === "bigint" ? ` #${id}` : ""} hamster`
      }
      dangerouslySetInnerHTML={{ __html: hamsterMarkup(id, name) }}
    />
  );
}

export function Emblem({ tier, size = 30 }: { tier: number; size?: number }) {
  const colors = ["#d49a6c", "#c1c7dd", "#eac56f", "#c9a5ff"];
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" aria-hidden="true">
      <path
        d="M20 2L36 10v14L20 42 4 24V10Z"
        fill={`${colors[tier]}14`}
        stroke={colors[tier]}
        strokeWidth="1.5"
      />
      <path
        d={
          tier === 3
            ? "M11 24l-1-10 7 5 3-10 3 10 7-5-1 10Z"
            : tier === 2
              ? "M20 11l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"
              : tier === 1
                ? "M20 12l9 10-9 10-9-10Z"
                : "M13 16h14v11l-7 5-7-5Z"
        }
        fill="none"
        stroke={colors[tier]}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Trophy({ place }: { place: number }) {
  const color = ["#eac56f", "#c1c7dd", "#d49a6c"][place - 1];
  return (
    <svg
      width="100"
      height="110"
      viewBox="0 0 100 110"
      role="img"
      aria-label={`Place ${place} trophy`}
    >
      <path
        d="M25 23H11v13q0 24 25 24m39-37h14v13q0 24-25 24"
        fill="none"
        stroke={color}
        strokeWidth="4"
      />
      <path
        d="M25 18h50v26q0 27-25 31-25-4-25-31Z"
        fill={`${color}20`}
        stroke={color}
        strokeWidth="3"
      />
      <path
        d="M50 76v18M32 100h36"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        fill={color}
        fontFamily="monospace"
        fontSize="25"
      >
        {place}
      </text>
      <path
        d="M42 4l8 5 8-5M17 79l4 4m60-4-4 4"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

export const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function shareText(
  a: string,
  b: string,
  scoreA: bigint,
  scoreB: bigint,
) {
  if (scoreA === scoreB) return `${a} tied ${b}`;
  const [winner, loser, high, low] =
    scoreA > scoreB ? [a, b, scoreA, scoreB] : [b, a, scoreB, scoreA];
  return low > 0n
    ? `${winner} beat ${loser} by ${Number(((high - low) * 10000n) / low) / 100}%`
    : `${winner} beat ${loser} by ${Number(high - low) / 1e6} points/member`;
}
export function shareCard(
  a: Pick<Guild, "id" | "name">,
  b: Pick<Guild, "id" | "name">,
  scoreA: bigint,
  scoreB: bigint,
  season: bigint,
  settled: boolean,
) {
  const nameA = guildLabel(a);
  const nameB = guildLabel(b);
  const text = settled
    ? shareText(nameA, nameB, scoreA, scoreB)
    : `${nameA} vs ${nameB} · Unsettled comparison`;
  const [winner, loser, high, low] =
    scoreA > scoreB
      ? [nameA, nameB, scoreA, scoreB]
      : [nameB, nameA, scoreB, scoreA];
  const line1 = !settled
    ? `${nameA} vs ${nameB}`
    : scoreA === scoreB
      ? `${nameA} tied ${nameB}`
      : `${winner} beat ${loser}`;
  const line2 = !settled
    ? "Unsettled comparison"
    : scoreA === scoreB
      ? "Same season average"
      : low > 0n
        ? `by ${Number(((high - low) * 10000n) / low) / 100}%`
        : `by ${Number(high - low) / 1e6} points/member`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><title>${escapeXml(text)}</title><rect width="1200" height="630" fill="#07070b"/><rect x="24" y="24" width="1152" height="582" rx="20" fill="#0d0d14" stroke="#232334"/><text x="64" y="90" fill="#c9a5ff" font-family="monospace" font-size="24">SQUEEK GUILD WARS / SEASON ${season}</text><g transform="translate(155 120) scale(1.4)">${hamsterMarkup(a.id, a.name)}</g><g transform="translate(800 120) scale(1.4)">${hamsterMarkup(b.id, b.name)}</g><path d="M360 300H840" stroke="#9e86b9" stroke-width="7"/><path d="M600 300v-55l32 17-32 17" fill="#a259ff"/><text x="600" y="411" text-anchor="middle" fill="#ecebf5" font-family="monospace" font-size="24">${escapeXml(line1)}</text><text x="600" y="451" text-anchor="middle" fill="#ecebf5" font-family="monospace" font-size="24">${escapeXml(line2)}</text><text x="600" y="499" text-anchor="middle" fill="#c9a5ff" font-family="monospace" font-size="20">${Number(scoreA) / 1e6} : ${Number(scoreB) / 1e6} points per member</text><text x="64" y="560" fill="#8a8aa3" font-family="monospace" font-size="18">Unofficial community project; no tokens, no payouts.</text></svg>`;
}
export function downloadSvg(svg: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
