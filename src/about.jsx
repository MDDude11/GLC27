import { useState } from "react";
import { ComicTitle, SiteFrame, Modal } from "./components.jsx";

const RELEASE_NOTES = [
  {
    version: "ITB v17",
    items: [
      "Added installable PWA support with an app manifest, standalone display metadata and GitHub Pages-aware service-worker registration.",
      "Added offline scorer resilience with a persistent Firebase write queue, ordered revisions and automatic retry when connectivity returns.",
      "Strengthened live-match race protection so rapid ball-by-ball updates cannot be replaced by an older remote snapshot on the same client.",
      "Made popup close controls universal, keyboard-safe and anchored outside long scrolling content; refreshed About-page typography and release-note presentation."
    ]
  },
  {
    version: "ITB v16.2",
    items: [
      "Added clean extensionless GitHub Pages URLs for the main site, programme, matches, match viewer, scorer, settings and About pages.",
      "Kept the existing .html entry points available for backward compatibility while normal navigation uses the clean routes.",
      "Added the release-notes panel to the About page."
    ]
  },
  {
    version: "ITB v16.1",
    items: [
      "Removed the Pace/Spin opening-bowling selector from The DRAFTS; it remains reserved for GLC27.",
      "Added pastel comic theme colours and applied the selected accent across buttons, highlights, press effects and other comic UI elements.",
      "Refined custom-match setup and archive handling for the DRAFTS workflow."
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
    version: "ITB v15.5",
    items: [
      "Aligned custom scoring with the D1/D2 lifecycle: toss, innings setup, live player state and second-innings setup.",
      "Made custom-match state updates merge with the complete match record so teams, players and metadata are preserved.",
      "Introduced the new custom-match naming workflow."
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
    version: "ITB v14.5",
    items: [
      "Strengthened custom-match synchronisation with REST polling alongside Firebase realtime updates.",
      "Made custom writes REST-first with server verification before falling back to the Firebase SDK.",
      "Updated Vite configuration to use import.meta.dirname."
    ]
  },
  {
    version: "ITB v14",
    items: [
      "Hardened custom-match lifecycle handling and management around the internal test-match workflow.",
      "Improved custom-match creation, deletion and Firebase-backed state handling.",
      "Polished internal-match archive presentation, card colours, contrast and spacing."
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
    version: "ITB v12",
    items: [
      "Established the fixed ITB baseline used for the later DRAFTS Firebase and multi-page work."
    ]
  },
  {
    version: "ITB v11",
    items: [
      "Stabilised dark-mode cards, popup clearance and close controls, including long-popup scrolling behaviour.",
      "Improved incoming-batter handling when no eligible replacement remains.",
      "Raised toast notifications above popup/backdrop layers.",
      "Added offline-state handling so the UI does not crash and provides a connection notice.",
      "Fixed free-hit persistence through wides and other illegal deliveries.",
      "Expanded reduced-motion handling, including mobile/coarse-pointer defaults.",
      "Connected Firebase Realtime Database for live scorer/viewer synchronisation and added deployment configuration for GitHub Pages/Firebase Hosting."
    ]
  },
  {
    version: "ITB v10",
    items: [
      "Improved modal expansion stability and safe clearance below the sticky navigation.",
      "Added adaptive standard-card theming.",
      "Fixed free-hit persistence through wides.",
      "Expanded reduced-motion handling with mobile-first defaulting."
    ]
  },
  {
    version: "ITB v9",
    items: [
      "Expanded the settings system with larger text, compact mode, reduced motion, sound effects and mobile vibration controls.",
      "Improved light/dark standard-card contrast and theme consistency across match, viewer and stats panels.",
      "Improved modal/page animation behaviour and added clearer wicket-count information in the viewer.",
      "Refined free-hit handling so illegal deliveries preserve the correct free-hit state."
    ]
  },
  {
    version: "ITB v8",
    items: [
      "Added stronger scorer guardrails by disabling scoring actions until a bowler is selected.",
      "Limited inline commentary to keep live panels compact while retaining the full commentary archive in pop-ups.",
      "Expanded settings and interaction feedback, including motion, sound and mobile vibration preferences.",
      "Refined popup and scorecard opening behaviour."
    ]
  },
  {
    version: "ITB v7.1",
    items: [
      "Fixed public viewer blank-screen initialization.",
      "Added unmistakable button press feedback.",
      "Refined popup spacing and replaced the floppy modal motion with a short, controlled origin transition."
    ]
  },
  {
    version: "ITB v7",
    items: [
      "Expanded the project into the Gala Luxuria Cup 2027 / The DRAFTS multi-page experience with programme, matches, viewer, scorer, settings and About pages.",
      "Refined the shared data-driven viewer/scorer architecture and reusable fixture model.",
      "Updated GLC27 branding, page titles and the overall comic presentation."
    ]
  },
  {
    version: "ITB v6",
    items: [
      "Expanded the match desk into a broader multi-page React/Vite application with reusable viewer/scorer components.",
      "Added the programme selector, settings page and About page around the match experience.",
      "Expanded scoring/state handling and the shared comic visual system, including richer player/stat presentation."
    ]
  },
  {
    version: "ITB v5",
    items: [
      "Introduced the tactile comic interaction system with physical controls, semantic button variants, pressed states, layered depth and controlled asymmetry.",
      "Established reusable match/scorer URLs instead of cloning source pages for every fixture.",
      "Refined the 3-wicket/6-over demo rules, including the sole-striker flow after the second wicket."
    ]
  },
  {
    version: "ITB v4",
    items: [
      "Historical v4 archive was not included in the supplied ZIP set, so no v4-specific changes are recorded here rather than guessing."
    ]
  },
  {
    version: "ITB v3",
    items: [
      "Rebuilt the site as a fuller React/Vite comic multi-page experience.",
      "Added semantic button variants, responsive layouts, stronger contrast and standardised match-card alignment.",
      "Established the shared comic visual language with marker typography, paper texture, halftone treatment, sticker/burst shapes and heavy ink offsets.",
      "Introduced reusable match viewer/scorer URLs and the shared data-driven match architecture."
    ]
  },
  {
    version: "ITB v2",
    items: [
      "Reworked the initial standalone prototype into a multi-page match site with separate D1/D2 viewer and scorer entry points.",
      "Introduced a shared scoring engine and data-driven match records while keeping the scoring model local-browser based.",
      "Added dedicated match archive and reusable application structure."
    ]
  },
  {
    version: "ITB v1",
    items: [
      "Initial standalone React/Vite prototype for The DRAFTS 2026 / GLC27.",
      "Introduced the comic/editorial visual system and two demo matches, D1 and D2.",
      "Added 3-player-per-side, 6-over, 3-wicket scoring with runs, wides, no-balls, wickets, automatic strike/over handling, innings transition and match completion.",
      "Added batting/bowling scorecards, commentary, undo history and LocalStorage persistence."
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
            <h3>The official player evaluation point</h3>
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
        <Modal onClose={() => setNotesOpen(false)} className="release-notes-modal paper-panel" ariaLabel="ITB release notes">
          <div className="release-notes-head">
            <div>
              <span className="panel-kicker">GLC27 / ITB HISTORY</span>
              <ComicTitle as="h2">Release <i>notes.</i></ComicTitle>
            </div>
            <button type="button" className="modal-close-button release-notes-close" onClick={() => setNotesOpen(false)} aria-label="Close release notes">×</button>
          </div>
          <div className="release-notes-scroll">
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
          </div>
        </Modal>
      )}
    </main>
  </SiteFrame>;
}
