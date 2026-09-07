import { ComicTitle, SiteFrame } from "./components.jsx";

export default function AboutPage() {
  return <SiteFrame active="about">
    <main className="section-wrap page-section utility-page">
      <div className="page-heading"><div><p className="eyebrow">GLC27 / ABOUT</p><ComicTitle>About the <i>season.</i></ComicTitle></div></div>
      <section className="about-stack">
        <article className="comic-panel paper-panel about-hero">
          <span className="panel-kicker">GALA LUXURIA CUP 2027</span>
          <ComicTitle as="h2">A tournament with its own world.</ComicTitle>
          <p>Gala Luxuria Cup 2027 is the wider competition experience than ever before. It is split into two phases: The <em>DRAFTS</em> and the official GLC27.</p>
        </article>
        <div className="about-columns">
          <article className="comic-panel dark-panel">
            <span className="panel-kicker">THE DRAFTS</span>
            <h3>The <em>DRAFTS</em></h3>
            <p>The official player evaluation point</p>
            <p>Occurring in the late winters of 2026, The <em>DRAFTS</em> is a one-of-a-kind player evaluation system where all players have a confidential dates roster. Each match day is same for 6 players, but no one who knows who all. The players meet half an hour before the match and get to know their team members, captains and opponents. 6 overs per side, along with one wicket per player. A short one-hour match with detailed player evaluation out of 100 points every match. Final selection for the GLC27 will happen on Final Night.</p>
          </article>
          <article className="comic-panel paper-panel">
            <span className="panel-kicker">GLC27</span>
            <h3>The Official Tournament</h3>
            <p>Occurring in the summers of 2027, the Gala Luxuria Cup 2027 will be back on a much bigger and grander scale than last year, with better management, matchmaking, and prizes. Details will be updated after The <em>DRAFTS</em> end. Give your best in The <em>DRAFTS</em> to be selected!</p>
          </article>
        </div>
      </section>
    </main>
  </SiteFrame>;
}
