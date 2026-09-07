import { HandDrawnBall, HandDrawnBat, SiteFrame } from "./components.jsx";

export default function HomePage() {
  return <SiteFrame active="home">
    <main className="landing-page">
      <section className="landing-hero section-wrap">
        <div className="landing-copy">
          <span className="landing-kicker">The Host presents</span>
          <h1 className="landing-title"><span>GALA</span><span>LUXURIA CUP</span><strong>2027</strong></h1>
          <p className="landing-subtitle">A new season. A new field. A new story.</p>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="landing-paper" />
          <div className="landing-rays" />
          <HandDrawnBat className="landing-bat" />
          <HandDrawnBall className="landing-ball" />
          <span className="landing-sticker">GLC27</span>
        </div>
        <a className="comic-button enter-website landing-enter" href="./programme.html">Enter website <span>↗</span></a>
      </section>
    </main>
  </SiteFrame>;
}
