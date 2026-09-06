import { ComicTitle, SiteFrame } from "./components.jsx";

export default function AboutPage() {
  return <SiteFrame active="about">
    <main className="section-wrap page-section utility-page">
      <div className="page-heading"><div><p className="eyebrow">GLC27 / ABOUT</p><ComicTitle>About the <i>season.</i></ComicTitle></div></div>
      <section className="about-stack">
        <article className="comic-panel paper-panel about-hero">
          <span className="panel-kicker">GALA LUXURIA CUP 2027</span>
          <ComicTitle as="h2">A tournament with its own world.</ComicTitle>
          <p>Gala Luxuria Cup 2027 is the wider competition experience. The DRAFTS sits inside that world as a player-focused chapter in the road to GLC27.</p>
        </article>
        <div className="about-columns">
          <article className="comic-panel dark-panel">
            <span className="panel-kicker">THE DRAFTS</span>
            <h3>PLAYER EVALUATION</h3>
            <p>Fast games, live scoring and player moments built to reveal how people adapt when the situation changes.</p>
          </article>
          <article className="comic-panel paper-panel">
            <span className="panel-kicker">GLC27</span>
            <h3>THE MAIN EVENT</h3>
            <p>The main Gala Luxuria Cup 2027 experience is being prepared as the next chapter of the season.</p>
          </article>
        </div>
      </section>
    </main>
  </SiteFrame>;
}
