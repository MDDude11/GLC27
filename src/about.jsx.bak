import { useState } from "react";
import { ComicTitle, SiteFrame } from "./components.jsx";

const RELEASE_NOTES = [
  {
    version: "ITB v12",
    items: [
      "Established the fixed ITB baseline used for the later DRAFTS Firebase and multi-page work."
    ]
  },
  {
    version: "ITB v13",
    items: [
      "Hardened custom-match Firebase lifecycle handling, including Firebase-first creation and custom-match deletion.",
      "Added deterministic pastel comic colours for internal match cards and polished the landing presentation and CSS.",
      "Updated the landing presenter label to “The Host presents”."
    ]
  },
  {
    version: "ITB v14",
    items: [
      "Moved custom-match live records onto the shared matches collection while retaining ITB-style identification for internal fixtures.",
      "Added Firebase-first verification, REST fallback, duplicate-submit protection and stronger internal-match management.",
      "Improved internal archive colours, typography, contrast and overall comic UI polish."
    ]
  },
  {
    version: "ITB v14.5",
    items: [
      "Strengthened custom-match synchronisation with REST polling alongside Firebase realtime updates.",
      "Made custom writes REST-first with server verification before falling back to the Firebase SDK.",
      "Updated Vite configuration to use import.meta.dirname."
    ]
  },
  {
    version: "ITB v15",
    items: [
      "Consolidated custom matches around the same matches/{id} Firebase source used by D1/D2 for live match state.",
      "Kept legacy ITB11-style records readable while adding compatibility handling for older internal-match data.",
      "Simplified the scorer/viewer live-data architecture around one authoritative match record."
    ]
  },
  {
    version: "ITB v15.5",
    items: [
      "Aligned custom scoring with the D1/D2 lifecycle: toss, innings setup, live player state and second-innings setup.",
      "Made custom-match state updates merge with the complete match record so teams, players and metadata are preserved.",
      "Added the new custom-match naming scheme to the creation workflow."
    ]
  },
  {
    version: "ITB v16",
    items: [
      "Reworked the custom-match journey to: create → Home → Matches → open match → toss/setup → Start Match.",
      "Placed custom matches in the main match archive alongside the demo fixtures.",
      "Made Start Match Firebase-first and verification-gated before switching the scorer into live mode.",
      "Added protection against stale remote callbacks overwriting newer custom-match state."
    ]
  },
  {
    version: "ITB v16.1",
    items: [
      "Removed the Pace/Spin opening-bowling selector from The DRAFTS; it remains reserved for GLC27.",
      "Added pastel comic theme colours and applied the selected accent to buttons, highlights, press effects and other comic UI elements.",
      "Refined custom-match setup and archive handling for the DRAFTS workflow."
    ]
  },
  {
    version: "ITB v16.2",
    items: [
      "Added clean extensionless GitHub Pages URLs: /GLC27, /programme, /matches, /match, /scorer, /settings and /about under the site base.",
      "Kept the existing .html pages available for backward compatibility while moving normal navigation to the clean routes.",
      "Added this release-notes panel to the About page."
    ]
  }
];

export default function AboutPage() {
  const [notesOpen, setNotesOpen] = useState(false);

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

      <div className="release-notes-wrap">
        <button type="button" className="release-notes-button" onClick={() => setNotesOpen(true)} aria-haspopup="dialog">Release notes ↗</button>
      </div>

      {notesOpen && (
        <div className="release-notes-overlay" role="dialog" aria-modal="true" aria-label="ITB release notes" onClick={() => setNotesOpen(false)}>
          <section className="release-notes-modal comic-panel paper-panel" onClick={(event) => event.stopPropagation()}>
            <div className="release-notes-head">
              <div>
                <span className="panel-kicker">GLC27 / ITB HISTORY</span>
                <ComicTitle as="h2">Release <i>notes.</i></ComicTitle>
              </div>
              <button type="button" className="release-notes-close" onClick={() => setNotesOpen(false)} aria-label="Close release notes">×</button>
            </div>
            <div className="release-notes-list">
              {RELEASE_NOTES.map((release) => (
                <article key={release.version} className="release-note-entry">
                  <div className="release-note-version">{release.version}</div>
                  <ul>
                    {release.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  </SiteFrame>;
}
