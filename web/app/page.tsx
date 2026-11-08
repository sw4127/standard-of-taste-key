import { Go } from "@sot/core/ui/nav";

export default function Home() {
  return (
    <section className="stack-lg">
      <p className="line">Words about your own taste in music, each with the songs and facts behind it, so you can check them.</p>
      <article className="card stack">
        <p className="voice">Name a few songs that come to mind, and see what they share.</p>
        <Go to="songs">Name a few songs</Go>
      </article>
      <article className="card stack">
        <p className="voice">Have years of Spotify history? See what arrived, left and came back.</p>
        <Go to="look-back">Drop a Spotify file</Go>
      </article>
      <p className="record">
        Listen on Bilibili in a PC browser? The Key, a side panel for Chrome or Edge, reads the song you are playing.
      </p>
    </section>
  );
}
