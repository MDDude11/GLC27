import { sitePath } from "./data.js";
import { useEffect, useState } from "react";
import { HandDrawnBall, HandDrawnBat, SiteFrame } from "./components.jsx";

const LANDING_LINES = [
  { text: "BIGGER", duration: 8000 },
  { text: "BETTER", duration: 8000 },
  { text: "GRANDER", duration: 8000 },
  { text: "MORE EXCITING", duration: 8000 },
  { text: "STEAMING FURY", duration: 15000, hot: true }
];

export default function HomePage() {
  const [lineIndex, setLineIndex] = useState(0);
  const line = LANDING_LINES[lineIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLineIndex((current) => (current + 1) % LANDING_LINES.length);
    }, line.duration);
    return () => window.clearTimeout(timer);
  }, [lineIndex, line.duration]);

  return <SiteFrame active="home">
    <main className="landing-page">
      <section className="landing-hero section-wrap">
        <div className="landing-copy">
          <span className="landing-kicker">The Host presents</span>
          <h1 className="landing-title"><span>GALA</span><span>LUXURIA CUP</span><strong>2027</strong></h1>
          <p className={`landing-subtitle landing-carousel${line.hot ? " landing-carousel-hot" : ""}`} key={line.text}>{line.text}</p>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="landing-paper" />
          <div className="landing-rays" />
          <HandDrawnBat className="landing-bat" />
          <HandDrawnBall className="landing-ball" />
          <span className="landing-sticker">GLC27</span>
        </div>
        <a className="comic-button enter-website landing-enter" href={sitePath("/programme")}>Enter website <span>↗</span></a>
      </section>
    </main>
  </SiteFrame>;
}
