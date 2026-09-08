import { useEffect, useState } from "react";
import { ComicTitle, SiteFrame } from "./components.jsx";

const DRAFTS_LINES = [
  "Adaptation is the game. The next moment changes everything.",
  "Read the field. Read the player. React faster.",
  "Three players. Six overs. Every decision matters.",
  "The situation changes. The best response changes with it.",
  "Nothing stays comfortable for long."
];

export default function ProgrammePage() {
  const [line, setLine] = useState(DRAFTS_LINES[0]);
  useEffect(() => {
    const timer = window.setInterval(() => setLine((current) => DRAFTS_LINES[(DRAFTS_LINES.indexOf(current) + 1) % DRAFTS_LINES.length]), 2600);
    return () => window.clearInterval(timer);
  }, []);
  return <SiteFrame>
    <main className="programme-page">
      <div className="programme-intro section-wrap">
        <span className="panel-kicker">CHOOSE YOUR WORLD</span>
        <ComicTitle>Enter the season.</ComicTitle>
      </div>
      <section className="programme-split section-wrap">
        <a className="programme-half drafts-half" href="./matches.html">
          <span className="programme-kicker">OPEN / ACTIVE</span>
          <ComicTitle>The <i>DRAFTS</i></ComicTitle>
          <p className="drafts-rotating" key={line}>{line}</p>
          <span className="programme-action">Enter The DRAFTS ↗</span>
        </a>
        <div className="programme-half glc-half locked-half" aria-disabled="true">
          <span className="programme-kicker">LOCKED / UPCOMING</span>
          <ComicTitle>GLC27</ComicTitle>
          <p>The Gala Luxuria Cup 2027 experience will open here when the competition is ready.</p>
          <span className="lock-plaque">LOCKED <b>×</b></span>
        </div>
      </section>
    </main>
  </SiteFrame>;
}
