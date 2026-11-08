export type IconName =
  | "rank"
  | "guild"
  | "war"
  | "recruit"
  | "trophy"
  | "plus"
  | "rules"
  | "arrow"
  | "refresh"
  | "check"
  | "wallet"
  | "close"
  | "external"
  | "search"
  | "copy";
const paths: Record<IconName, string> = {
  rank: "M4 20h16M6 16V9h4v7m0 4V4h4v16m0-4v-4h4v4",
  guild: "M12 3l8 4v6q-1 6-8 9-7-3-8-9V7ZM8 12l3 3 5-6",
  war: "M4 4l16 16M4 20L20 4M3 3l6 1-5 5Zm18 0-6 1 5 5ZM3 17l4 4m10 0 4-4",
  recruit:
    "M15 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6m10 0v6m-3-3h6",
  trophy:
    "M7 4h10v6a5 5 0 0 1-10 0ZM7 6H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 2v5m-4 0h8",
  plus: "M12 5v14M5 12h14",
  rules: "M6 3h12v18l-6-3-6 3ZM9 7h6m-6 4h6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  refresh:
    "M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5m-4 6a8 8 0 0 0 14 5l3-3m0 5v-5h-5",
  check: "M5 12l4 4L19 6",
  wallet: "M3 6h17v14H3ZM3 6V3h14v3m3 5h-5v4h5",
  close: "M6 6l12 12M6 18 18 6",
  external: "M14 3h7v7m0-7L11 13m-1-8H4v15h15v-6",
  search: "M16 16l5 5m-3-11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  copy: "M8 8h12v13H8ZM16 8V3H3v13h5",
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
