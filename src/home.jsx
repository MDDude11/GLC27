import { sitePath } from "./data.js";
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
          <svg className="landing-vector-art" viewBox="0 0 560 760" role="img" aria-label="Stylized cricket bat and green tennis ball illustration">
            <defs>
              <linearGradient id="landingBatWood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f1c074" />
                <stop offset="0.52" stopColor="#d9a45f" />
                <stop offset="1" stopColor="#b97837" />
              </linearGradient>
              <linearGradient id="landingBatFace" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffe1a0" />
                <stop offset="0.6" stopColor="#e6ae63" />
                <stop offset="1" stopColor="#bd7d3c" />
              </linearGradient>
              <linearGradient id="landingGrip" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#34302b" />
                <stop offset="1" stopColor="#11100d" />
              </linearGradient>
              <radialGradient id="landingBall" cx="35%" cy="28%" r="76%">
                <stop offset="0" stopColor="#e7ff67" />
                <stop offset="0.46" stopColor="#b9ef27" />
                <stop offset="1" stopColor="#79b80f" />
              </radialGradient>
              <pattern id="landingDots" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1.55" fill="currentColor" opacity=".22" />
              </pattern>
              <filter id="landingShadow" x="-30%" y="-30%" width="180%" height="180%">
                <feDropShadow dx="10" dy="12" stdDeviation="0" floodColor="#000" floodOpacity=".58" />
              </filter>
              <filter id="landingBallShadow" x="-50%" y="-50%" width="220%" height="220%">
                <feDropShadow dx="8" dy="9" stdDeviation="0" floodColor="#000" floodOpacity=".58" />
              </filter>
            </defs>

            <g className="landing-vector-backdrop">
              <rect x="38" y="72" width="474" height="572" rx="4" fill="currentColor" opacity=".055" />
              <polygon points="53,93 485,118 501,624 69,657" fill="var(--paper)" opacity=".34" stroke="var(--line)" strokeWidth="3" />
              <rect x="0" y="0" width="560" height="760" fill="url(#landingDots)" />
              <g className="landing-vector-rays" opacity=".46">
                <path d="M276 325 L282 132 L300 290 L366 154 L327 306 L434 242 L343 328 L466 350 L333 351 L421 444 L325 374 L350 503 L294 380 L247 510 L261 377 L154 439 L240 345 L106 322 L242 321 L160 222 L254 300 Z" fill="var(--olive, #a4aa43)" />
              </g>
            </g>

            <g className="landing-vector-bat" transform="translate(238 50) rotate(18 0 330)" filter="url(#landingShadow)">
              <path className="landing-vector-bat-shadow" d="M-10 46 C-16 59 -18 90 -12 116 L0 169 C-25 201 -48 249 -57 318 C-68 401 -60 534 -38 646 C-32 680 -10 704 17 708 C48 712 73 690 79 656 C101 530 105 411 86 320 C78 268 58 214 31 175 L39 119 C43 89 37 62 23 46 Z" />
              <path className="landing-vector-bat-body" d="M-3 43 C-10 60 -11 88 -5 113 L4 166 C-20 197 -43 247 -52 315 C-62 400 -54 532 -32 642 C-26 674 -6 694 20 698 C49 702 68 683 73 651 C94 528 99 412 81 320 C73 269 53 215 27 173 L35 116 C39 87 33 59 22 43 Z" />
              <path className="landing-vector-bat-edge" d="M4 167 C-18 205 -33 253 -41 318 C-51 406 -43 525 -25 632 C-20 662 -5 679 17 684" />
              <path className="landing-vector-bat-grain" d="M-20 292 C7 307 36 312 65 299 M-28 377 C3 392 35 396 71 383 M-26 465 C6 479 37 482 74 470 M-18 551 C11 564 39 568 67 558" />
              <path className="landing-vector-bat-spine" d="M15 186 L13 666" />
              <path className="landing-vector-grip" d="M-4 48 C-10 67 -9 88 -4 108 L5 162 L31 164 L36 112 C40 87 34 61 22 45 Z" />
              <path className="landing-vector-grip-line" d="M-5 67 L36 77 M-6 84 L35 94 M-4 101 L34 111 M-2 118 L32 128 M1 136 L30 145" />
              <path d="M-17 216 L40 183" stroke="var(--blue)" strokeWidth="12" opacity=".92" />
              <path d="M-20 232 L45 194" stroke="var(--accent)" strokeWidth="6" opacity=".92" />
              <path d="M20 240 l28 20 l-34 19 l-20-16 z" fill="var(--blue)" opacity=".92" />
              <path d="M19 247 C28 236 38 234 48 241 C38 252 31 262 25 275 C14 267 10 257 19 247 Z" fill="var(--accent)" stroke="var(--line)" strokeWidth="2" />
              <path d="M21 246 C26 249 30 255 31 262 C24 263 18 259 14 254 Z" fill="var(--blue)" opacity=".95" />
              <path d="M29 244 C34 239 39 239 44 242 C40 246 37 251 35 256 C30 254 27 249 29 244 Z" fill="var(--gold, #f3c44f)" opacity=".95" />
            </g>

            <g className="landing-vector-ball" transform="translate(402 536) rotate(-22)" filter="url(#landingBallShadow)">
              <circle cx="0" cy="0" r="62" fill="url(#landingBall)" stroke="var(--line)" strokeWidth="5" />
              <ellipse cx="-20" cy="-23" rx="17" ry="10" fill="#f4ffab" opacity=".36" />
              <path d="M-41 -17 C-20 -5 -5 14 0 37 C5 51 13 58 25 61" fill="none" stroke="#f8ffe8" strokeWidth="5" strokeLinecap="round" />
              <path d="M-29 -32 L-22 -37 M-18 -22 L-11 -27 M-8 -9 L-2 -14 M1 4 L7 -1 M7 17 L13 13 M10 31 L16 28 M17 44 L23 40" fill="none" stroke="#f8ffe8" strokeWidth="2.6" strokeLinecap="round" />
              <text x="-24" y="10" className="landing-vector-ball-brand" transform="rotate(8)">COSCO</text>
              <path d="M-58 56 C-28 78 18 84 54 65" fill="none" stroke="var(--olive, #a4aa43)" strokeWidth="6" opacity=".44" />
            </g>

            <g className="landing-vector-badge" transform="translate(420 48) rotate(4)">
              <rect x="0" y="0" width="88" height="45" rx="2" fill="var(--accent)" stroke="var(--line)" strokeWidth="3" />
              <text x="44" y="29" textAnchor="middle" className="landing-vector-badge-text">GLC27</text>
            </g>
          </svg>
        </div>
        <a className="comic-button enter-website landing-enter" href={sitePath("/programme")}>Enter website <span>↗</span></a>
      </section>
    </main>
  </SiteFrame>;
}
