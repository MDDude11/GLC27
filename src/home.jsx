import { sitePath, isAndroid, isStandalonePWA } from "./data.js";
import { useEffect, useState } from "react";
import { SiteFrame } from "./components.jsx";

const LANDING_LINES = [
  { text: "BIGGER", duration: 4000 },
  { text: "BETTER", duration: 4000 },
  { text: "GRANDER", duration: 4000 },
  { text: "MORE EXCITING", duration: 4000 },
  { text: "STEAMING FURY", duration: 10000, hot: true }
];

export default function HomePage() {
  const [lineIndex, setLineIndex] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalonePWA());
  const line = LANDING_LINES[lineIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLineIndex((current) => (current + 1) % LANDING_LINES.length);
    }, line.duration);
    return () => window.clearTimeout(timer);
  }, [lineIndex, line.duration]);

  useEffect(() => {
    if (!isAndroid() || isStandalonePWA()) return undefined;
    const onPrompt = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      try { await installPrompt.userChoice; } catch {}
      setInstallPrompt(null);
      return;
    }
    window.alert("In Chrome, use ⋮ → Add to Home screen or Install app.");
  };

  return <SiteFrame active="home">
    <main className="landing-page">
      <section className="landing-hero section-wrap">
        <div className="landing-copy">
          <span className="landing-kicker">The Host presents</span>
          <h1 className="landing-title"><span>GALA</span><span>LUXURIA CUP</span><strong>2027</strong></h1>
          <p className={`landing-subtitle landing-carousel${line.hot ? " landing-carousel-hot" : ""}`} key={line.text}>{line.text}</p>
        </div>
        <a className="comic-button enter-website landing-enter" href={sitePath("/programme")}>Enter website <span>↗</span></a>
        {isAndroid() && !installed && <button type="button" className="comic-button landing-install" onClick={install}>Install app <span>↗</span></button>}
      </section>
    </main>
  </SiteFrame>;
}
