import { useState } from "react";
import { ComicTitle, SiteFrame, Modal } from "./components.jsx";

const RELEASE_NOTES = [
  {
    version: "ITB v21",
    items: [
      "Fixed the incoming-batter flow after a wicket or retirement so selecting a batter in the popup now commits that exact selection instead of revalidating against stale live-player state.",
      "The incoming-batter popup now keeps an explicit eligible-player list, supports direct player selection, and verifies that the selected batter is still available before writing the new live state.",
      "Fixed the same replacement flow for both the main match and recursive Super Over stages.",
      "Changed the halftone background interaction so the original dot grows in place toward the pointer, with no positional pull, duplicate under-dot or second dot being painted as the enlarged state.",
      "Bumped the PWA shell cache to ensure v21 clients receive the corrected scorer and background interaction code.",
      "No changes were made to the underlying dismissal, retirement or match-scoring rules beyond making the existing incoming-player flow reliable."
    ]
  },
  {
    version: "ITB v20",
    items: [
      "Fixed the public viewer crash caused by a missing MAX_WICKETS import.",
      "Made compact mode a true information-at-a-glance presentation while keeping scoring behaviour unchanged.",
      "Hardened retirement, wicket and incoming-player selection so eligible batters remain selectable after each dismissal type.",
      "Made Super Over teams and opening-player choices derive from the tied stage, with duplicate-player and wrong-team starts rejected.",
      "Improved setup-card theming, dark-mode bowler-choice contrast, over-strip readability and interaction smoothness.",
      "No scoring rules, Firebase schema or ordinary match lifecycle semantics were intentionally changed."
    ]
  },
  {
    version: "ITB v19",
    items: [
      "Added recursive Super Over scoring for tied matches, with the same match record retaining the main match and every Super Over stage.",
      "A tied main match or tied Super Over now exposes BEGIN SUPER OVER beside VIEW SCORECARD; another tied Super Over can start the next stage without an arbitrary depth limit.",
      "Overall match progression and scorecards now show the main match followed by every Super Over, including the final deciding stage.",
      "Restored the dedicated Retired Hurt / Retired Out flow below WIDE; the normal WICKET menu contains genuine dismissal types only.",
      "Retired Hurt does not count as a wicket or bowler wicket, shows a grey H wicket-counter state, and becomes eligible to return only after two wickets are down.",
      "Retired Out counts as an innings wicket but never as a bowler wicket.",
      "Added compact match presentation across scorer and viewer pages, anchored section headers that condense while scrolling, and expandable commentary/scorecard sections.",
      "Removed Pace/Spin setup choices from Match Begin and second-innings setup and made setup surfaces follow the active theme.",
      "Placed modal layers above the footer and other page chrome, refined the Programme Drafts hover treatment, and fixed magnetic halftone dots so the affected dots are replaced by their enlarged state instead of being painted twice.",
      "No intentional changes were made to Firebase authority, existing match lifecycle semantics, or ordinary delivery scoring behaviour outside the requested retirement and Super Over flows."
    ]
  },
  {
    version: "ITB v18.5",
    items: [
      "Fixed the scorer render crash by removing the UI-level dependency on normalizeDeliveries from components.jsx and scorer.jsx.",
      "Restored the simpler v16.2-style delivery handling in the scorer UI while still accepting Firebase array and object-shaped delivery records.",
      "Kept normalization inside the scoring/data layer where it is needed for Firebase resilience, without importing that helper into React render components.",
      "Bumped the PWA service-worker cache so the corrected scorer assets are treated as a new release shell.",
      "No scoring rules, Firebase schema, match lifecycle or navigation behaviour was intentionally changed by this hotfix."
    ]
  },
  {
    version: "ITB v18.0.1",
    items: [
      "Fixed the scorer page failing during React render because components.jsx referenced normalizeDeliveries without importing it.",
      "Bumped the PWA service-worker cache so the corrected scorer bundle is treated as a new shell version.",
      "No scoring rules, Firebase schema or match lifecycle changes were introduced by this patch."
    ]
  },
  {
    version: "ITB v18",
    items: [
      "Restored the scorer on GitHub Pages by routing scorer links through the stable scorer.html entry point and hardening clean-route service-worker fallbacks.",
      "Made Firebase match reads REST-first with a controlled SDK fallback, so scorer startup does not depend on the Firebase module loading path alone.",
      "Added a REST polling fallback for live match updates when Firebase realtime subscriptions cannot initialise, while keeping realtime listeners as the preferred path.",
      "Preserved queued offline scorer writes across the v17 → v18 storage-key change and continued automatic retry when connectivity returns.",
      "Completed delivery-shape normalization across remote custom matches so Firebase list/object representations cannot crash scoring or silently erase balls.",
      "Added a complete incremental release-note history for v17.5, v17.6, v17.7, v17.7.1, v18.0.0 and v18.0.1."
    ]
  },
  {
    version: "ITB v17.7.1",
    items: [
      "Fixed the live-scoring crash caused when Firebase represented deliveries as an object instead of a JavaScript array.",
      "Normalized numeric-keyed delivery objects in ball order instead of discarding existing deliveries.",
      "Applied the delivery normalization consistently across scorer state, persistence, commentary, wicket displays and player statistics.",
      "Bumped the PWA service-worker cache so the scoring hotfix could be picked up by new clients."
    ]
  },
  {
    version: "ITB v17.7",
    items: [
      "Introduced centralized delivery normalization as the foundation for resilient Firebase-backed live scoring.",
      "Hardened innings calculations and scorer data handling against inconsistent delivery-list shapes.",
      "Prepared the live scorer and viewer pipeline for Firebase list/object compatibility without changing the match rules."
    ]
  },
  {
    version: "ITB v17.6",
    items: [
      "Versioned the service-worker cache and strengthened update checks so new deployments invalidate older PWA shell assets.",
      "Pre-cached public pages and built local assets, with offline support for extensionless GitHub Pages routes.",
      "Added a short navigation timeout and static-asset caching strategy for weak networks.",
      "Kept Firebase authoritative when reachable while preserving the offline match snapshot and queued-write path."
    ]
  },
  {
    version: "ITB v17.5",
    items: [
      "Optimized innings calculations with delivery-array memoization and linear iteration.",
      "Reduced halftone pointer rendering work by caching the static dot field and repainting only the affected region.",
      "Reduced decorative rendering cost on small screens and deferred below-the-fold match detail painting.",
      "No scoring rules, Firebase data model or navigation behaviour was intentionally changed by this performance pass."
    ]
  },
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
