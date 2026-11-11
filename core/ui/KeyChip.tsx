/**
 * How a key is shown (Card stock, second version; design rules 4, 6 and 12). Every card that shows a
 * key names it in words and marks it on a small circle of twelve dots; the key's colour is also the
 * flat rule along the card's lower edge. A card with no measured key has no rule and says so.
 */
import { circlePlaces, LARGE, placeXY, SMALL, type Place } from "../src/design/key-circle";
import { circlePlace, keyName, keyVars, type Key } from "../src/design/key-colour";

const MAJOR_NAMES = ["C", "G", "D", "A", "E", "B", "F-sharp", "D-flat", "A-flat", "E-flat", "B-flat", "F"];
const majorPitch = (place: number) => (place * 7) % 12;
const keyAt = (place: number, mode: Key["mode"]): Key => ({ pitch: mode === "major" ? majorPitch(place) : (majorPitch(place) + 9) % 12, mode });

/** The key's name beside its place on the circle of twelve keys. */
export function KeyChip({ k }: { k: Key | null | undefined }) {
  if (!k) return <span className="key-name">Key not measured</span>;
  const at = placeXY(circlePlace(k), SMALL.ring, SMALL.size);
  return (
    <span className="key-mark">
      <svg className="key-ring" width={SMALL.size} height={SMALL.size} viewBox={`0 0 ${SMALL.size} ${SMALL.size}`} role="img" aria-label={`${keyName(k)} on the circle of twelve keys`}>
        {Array.from({ length: 12 }, (_, i) => {
          const p = placeXY(i, SMALL.ring, SMALL.size);
          return <circle key={i} className="tick" cx={p.x} cy={p.y} r={SMALL.tick} />;
        })}
        <circle className="key-fill" style={keyVars(k)} cx={at.x} cy={at.y} r={SMALL.dot} />
      </svg>
      <span className="key-name">{keyName(k)}</span>
    </span>
  );
}

/** The card's lower rule: the key's colour, or no rule when no key was measured. */
export const edgeStyle = (k: Key | null | undefined) => (k ? keyVars(k) : {});
/** The class that draws the rule; a card with no measured key gets none. */
export const edgeClass = (k: Key | null | undefined) => (k ? " keyed" : "");

function describe(places: Place[]): string {
  const marked = places.filter((p) => p.total > 0);
  if (!marked.length) return "The circle of twelve keys, with no songs marked yet";
  return (
    "The circle of twelve keys, with your songs marked: " +
    marked.map((p) => `${p.total} in ${MAJOR_NAMES[p.place]} major${p.minor ? " or the minor key that uses the same notes" : ""}`).join(", ")
  );
}

/**
 * The large circle (design rule 12): twelve places, a dot that grows in four steps, the count written
 * outside from two songs up, a dark centre where some songs are in the minor key with the same notes.
 * `onPick` makes each marked dot a control that lists its songs.
 */
export function KeyCircle({ keys, onPick, picked }: { keys: Key[]; onPick?: (place: number) => void; picked?: number | null }) {
  const places = circlePlaces(keys);
  const { size, ring, radius, centre, countAt } = LARGE;
  return (
    <svg className="key-circle" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={onPick ? "group" : "img"} aria-label={describe(places)}>
      {places.map((p) => {
        const at = placeXY(p.place, ring, size);
        const out = placeXY(p.place, countAt, size);
        const allMinor = p.total > 0 && p.major === 0;
        const dot = (
          <>
            <circle className="key-fill" style={keyVars(keyAt(p.place, allMinor ? "minor" : "major"))} cx={at.x} cy={at.y} r={radius[p.step]} />
            {p.minor > 0 && !allMinor && <circle className="key-fill" style={keyVars(keyAt(p.place, "minor"))} cx={at.x} cy={at.y} r={centre} />}
            {p.total >= 2 && (
              <text className="key-count" x={out.x} y={out.y} textAnchor="middle" dominantBaseline="central">
                {p.total}
              </text>
            )}
          </>
        );
        if (!onPick || p.total === 0) return <g key={p.place}>{dot}</g>;
        return (
          <g
            key={p.place}
            className="key-dot-button"
            role="button"
            tabIndex={0}
            aria-pressed={picked === p.place}
            aria-label={`${p.total} ${p.total === 1 ? "song" : "songs"} in ${MAJOR_NAMES[p.place]} major or the minor key that uses the same notes`}
            onClick={() => onPick(p.place)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(p.place);
              }
            }}
          >
            <circle cx={at.x} cy={at.y} r={12} fill="transparent" />
            {dot}
          </g>
        );
      })}
    </svg>
  );
}

/** Design rule 6, word for word: what the circle is, in sentences a person can check against the drawing. */
export const CIRCLE_SENTENCES =
  "Twelve musical keys form a circle. Neighboring keys share all but one of their seven notes, so they get similar colors. Dark dots mark minor keys. Large dots are the keys of your songs.";
