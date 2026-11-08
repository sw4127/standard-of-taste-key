/**
 * Stories (the one exception to rule 1): stored, checked, shown behind a tap and labelled
 * "A story chosen for this song" (FR-T3.1). Only the stories a reviewer accepted in Stage 6 (S-2), each
 * with the sources it was checked against; tone readings are never carried (PRD section 8). A story
 * never addresses the listener and passes the "story" layer of FR-CORE-2.
 *
 * Sancho's story (FR-T3.4): Hume, "Of the Standard of Taste" (1757), paragraph 15, public domain. The
 * three-sentence retelling is written in Bob's voice (his ruling, 2026-11-08); the last line is Hume's.
 */
export const STORY_LABEL = "A story chosen for this song";

export interface Story {
  song: string;
  artist: string;
  text: string;
  sources: string[];
}

export const STORIES: Story[] = [
  { song: "Gasoline", artist: "The Weeknd", text: "In Dante's Purgatorio, souls newly landed on the shore stop to hear a friend sing, and forget where they are going, until an old guard scolds them and they scatter toward the mountain.", sources: ["https://sacred-texts.com/chr/dante/pu02.htm", "https://en.wikipedia.org/wiki/Dawn_FM"] },
  { song: "Faith", artist: "The Weeknd", text: "Augustine, in his Confessions, recalls praying as a young man for self-control, and adding: but not yet.", sources: ["https://www.newadvent.org/fathers/110108.htm", "https://en.wikipedia.org/wiki/Faith_(The_Weeknd_song)"] },
  { song: "True Colors", artist: "The Weeknd", text: "In Apuleius's tale, Psyche is forbidden to look at the husband who comes to her only in the dark. One night she lights a lamp to see his face, and a drop of hot oil wakes him.", sources: ["https://en.wikipedia.org/wiki/Cupid_and_Psyche", "https://www.nationalgallery.org.uk/paintings/glossary/psyche", "https://www.spinmagazine.com/2016/11/review-the-weeknd-starboy/"] },
  { song: "Let You Down", artist: "Dawid Podsiadło", text: "In the old Chinese tale, Chang'e drinks an elixir meant for two and rises to the moon alone; on the ground, the archer Hou Yi sets out fruit and cakes beneath it.", sources: ["https://folklore.usc.edu/change-journey-to-the-moon-and-the-origin-of-mid-autumn-festival/", "https://en.wikipedia.org/wiki/Chang%27e", "https://www.chinatravel.com/culture/mid-autumn-festival-story"] },
  { song: "Come to Life", artist: "Kanye West", text: "In the Gospel of John, Jesus stands at the tomb of his friend Lazarus, four days dead, and calls him by name to come out; and he comes out.", sources: ["https://www.biblegateway.com/passage/?search=John%2011&version=KJV", "https://en.wikipedia.org/wiki/Donda_(album)"] },
  { song: "Trinidad", artist: "Geese", text: "At every red light he checked the mirror, sure something was following him, laughed at himself, and checked again.", sources: ["https://en.wikipedia.org/wiki/Getting_Killed", "https://en.wikipedia.org/wiki/Trinidad_(song)"] },
  { song: "Kyoto", artist: "Phoebe Bridgers", text: "The poet Bashō wrote a haiku that says: even in Kyoto, hearing the cuckoo, I long for Kyoto.", sources: ["https://poetryfoundation.org/poems/48708/in-kyoto-", "https://writersinkyoto.com/?p=802", "https://en.wikipedia.org/wiki/Kyoto_(Phoebe_Bridgers_song)"] },
  { song: "Let Down", artist: "Radiohead", text: "She fell asleep on the last train and woke at the end of the line, in a town she had never seen, and walked around it until the first train back.", sources: ["https://en.wikipedia.org/wiki/Let_Down_(Radiohead_song)"] },
  { song: "Pink + White", artist: "Frank Ocean", text: "Ecclesiastes says: one generation passes away, and another comes, but the earth abides; the sun also rises, and the sun goes down.", sources: ["https://www.biblegateway.com/passage/?search=Ecclesiastes+1&version=KJV", "https://spartanshield.org/?p=35093"] },
  { song: "Kill Bill", artist: "SZA", text: "She still knew his new address and never once walked down that street, which took more effort than it sounds.", sources: ["https://en.wikipedia.org/wiki/Kill_Bill_(SZA_song)"] },
];

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** The story for a recording, matched by title and lead artist, or none. */
export function storyFor(title: string, leadArtist: string): Story | undefined {
  return STORIES.find((s) => norm(s.song) === norm(title) && norm(leadArtist).includes(norm(s.artist)));
}

export const SANCHO = {
  title: "The key in the barrel",
  // In Bob's voice (2026-11-08): concrete first, the weight at the end, a short sentence to land it.
  retelling: [
    "Two of Sancho's kinsmen were asked to taste a barrel of wine, and both called it good.",
    "One added that it carried a faint taste of leather; the other, after the same care, found iron.",
    "Everyone laughed at them.",
  ],
  hume: "But who laughed in the end? On emptying the hogshead, there was found at the bottom, an old key with a leathern thong tied to it.",
  source: { label: "David Hume, “Of the Standard of Taste” (1757), paragraph 15", url: "https://davidhume.org/texts/empl1/st" },
};
