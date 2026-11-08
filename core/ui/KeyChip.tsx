import { chipColour, edgeColour, keyName, type Key } from "../src/design/key-colour";

/** The key chip: the key's hue behind ink, always naming the key in words. */
export function KeyChip({ k }: { k: Key | null | undefined }) {
  if (!k) return <span className="key-chip">Key not measured</span>;
  return (
    <span
      className="key-chip"
      style={{ ["--chip-light" as string]: chipColour(k, "light"), ["--chip-dark" as string]: chipColour(k, "dark") }}
    >
      {keyName(k)}
    </span>
  );
}

/** The card's painted edge: the key's colour, or the hairline when no key was measured. */
export const edgeStyle = (k: Key | null | undefined) => (k ? { ["--edge" as string]: edgeColour(k) } : {});
