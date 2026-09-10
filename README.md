# ITB v22.8 — Standalone reliability + UI polish

## v22.8.0 — Standalone reliability + UI polish
- Applied the eight requested v22.6 fixes: themed setup selectors, actual sound defaulting off, custom scrollbars, anchored/shrinking popup headers, 10-second REDO, Retired Out solo handling, full crest header branding, and 4s/10s homepage messaging.
- Added generic descendant-scroll detection so every long popup can condense its heading consistently.

## v22.6.0
- Fixed scorer/setup `<select>` controls rendering with browser-default dark/black chrome; they now use the active GLC theme with a custom in-theme arrow and readable selected text.
- Applied the setup-control correction to opening-player setup, second-innings setup and Super Over setup.
- Rebuilt the interaction click cue so it reliably resumes/starts the Web Audio context from the user gesture and uses an audible two-note comic tick when Sound effects is enabled.
- Kept **Sound effects OFF by default** and removed the possibility of the stale/default-on presentation surviving the new sound migration.
- Bumped the PWA shell version so v22.6 assets supersede cached v22.5 assets.

## v22.5.0
- Made scorer/setup controls follow the active visual theme instead of using legacy light/default fills, including borders, shadows, labels, focus states and select arrows.
- Fixed interaction sound settings so **Sound effects is OFF by default**, including a one-time migration of existing settings that still carried the broken/default-on state.
- Tuned the short interaction cue so it is actually audible while remaining subtle.
- Added **RESUME UNDOING** to mandatory-choice states reached because of Undo, allowing the scorer to continue to the previous normal state rather than being trapped at the same required choice.
- Applied the mandatory-choice undo handling to incoming-batter and Retired Hurt return checkpoints.

## v22.0.0
- Fixed Standalone scoring after 2 wickets or 1 wicket + 1 retirement so a sole remaining batter no longer triggers a false non-striker requirement.
- Added **EDIT MANUALLY** to adjust either team's score by **+1, +2, +5, -5, -2, -1** without creating a delivery or changing player/ball/bowler figures.
- Popup headers now condense while scrolling in normal and compact modes.
- Added a real short click tune controlled by Settings; sound is off by default and earlier settings are migrated off once for v22.
- Added the supplied Gala Luxuria Cup 2027 emblem as the favicon across site entry points.
- Protected **RESET DEMO** in matches.html with the scorer password.
- Added v22 release notes to the site About page and refreshed the PWA shell version.

## v21.0.0 — Scorer replacement flow + in-place dot growth
- Fixed the incoming-batter selection race after wickets/retirements.
- Applied the incoming-batter fix to main match and recursive Super Over stages.
- Made halftone dots grow at their original coordinates instead of pulling/repainting a second dot.

## v20.0.0 — Match experience + recursive Super Overs
- Added recursive Super Overs, stage progression and scorecard coverage.
- Added Retired Hurt / Retired Out controls with the defined wicket/return semantics.
- Added compact match presentation, anchored headers, setup/theme fixes and match UI hardening.

# GLsiteITB18 — Gala Luxuria Cup 2027 / The *DRAFTS*

Version 18.0.1 internal test build / publish candidate.

The v18 release family includes the complete incremental patch history for v17.5, v17.6, v17.7 and v17.7.1 in the About → Release notes panel.

## v18.0.1 — Scorer render hotfix
- Fixed a production scorer-render failure where `components.jsx` used `normalizeDeliveries` without importing it, causing `ReferenceError: normalizeDeliveries is not defined`.
- Kept the v18 Firebase, PWA, offline queue and delivery-normalization architecture unchanged; this patch only restores the scorer component dependency and bumps the service-worker cache.

## v18.0.0 — Firebase + PWA stability pass
- Restored the scorer on GitHub Pages by making scorer links use the stable `scorer.html` entry point and strengthening clean-route service-worker fallbacks.
- Made Firebase match reads REST-first with a controlled Firebase SDK fallback so scorer startup is not blocked solely by the remote module import path.
- Added REST polling fallbacks for live match updates and the match archive when Firebase realtime subscriptions cannot initialise.
- Preserved queued offline scorer writes across the v17 → v18 queue-key migration.
- Normalized Firebase delivery lists consistently across custom-match reads, writes, scorer state and statistics.
- Added post-build output verification to CI so all public entry pages and the scorer bundle must exist before deployment.

## v17.7.1 — Scoring hotfix
- Fixed the `deliveries is not iterable` live-scorer crash when Firebase returned deliveries as an object.
- Restored numeric-keyed Firebase delivery objects in their stored order instead of discarding them.
- Applied delivery normalization across scorer, store, commentary, wicket display and statistics.
- Bumped the service-worker cache version.

## v17.7 — Scoring hardening groundwork
- Introduced centralized delivery normalization for resilient Firebase-backed live scoring.
- Hardened innings calculations and scorer data handling against inconsistent delivery-list shapes.
- Kept match rules and the Firebase data model unchanged.

## v17.6 — PWA + low-network hardening
- Versioned the service-worker cache and strengthened update checks.
- Pre-cached public pages and built local assets, including offline extensionless routes.
- Added a short navigation timeout and static-asset caching strategy for weak networks.
- Retained the offline match snapshot and queued Firebase-write path.

## v17.5 — Performance pass
- Optimized innings calculations with delivery-array memoization and linear iteration.
- Reduced halftone rendering work by caching the static dot field and repainting only the affected region.
- Reduced decorative rendering cost on small screens and deferred below-the-fold match detail painting.
- No intentional scoring, Firebase, navigation or match-rule changes.

## v17 — PWA + live-state resilience
- Added installable PWA support, persistent offline Firebase write queue, ordered revisions, race protection, and improved modal/release-note behaviour.


## Firebase Hosting
Install the CLI with `npm install -g firebase-tools`, then authenticate with `firebase login`. From the repository root:

`npm run build`
`firebase deploy --only hosting`

To deploy the Realtime Database rules as well:

`firebase deploy --only hosting,database`

The current `database.rules.json` is intentionally open for this internal test build. Tighten the rules before any public production deployment.


## v14 internal admin

Settings contains a restricted Admin Mode at the bottom. The development fallback password is `DRAFTSADMIN11`; set `VITE_ADMIN_PASSWORD` before publishing to use your own password. The GitHub Pages workflow reads the GitHub Actions secret `VITE_ADMIN_PASSWORD`. This is a client-side gate, not secure authentication, because a static-site password is present in the browser bundle after build.

Custom matches use the same Firebase Realtime Database `/matches/<matchId>` records and realtime listener path as the official demo matches. New matches use `custom-XXXXX-` IDs; legacy `ITB11-...` IDs remain supported for compatibility.

GitHub Pages can serve the Vite build output from `dist`; Firebase Hosting uses `firebase.json` and the same static build.


## v14 changes

- Internal test matches remain logically separated by their `ITB...` IDs while using the shared `matches` Firebase collection.
- Internal match creation is Firebase-first and verified before local caching, with REST fallback.
- Internal match subscriptions use direct RTDB realtime updates with REST fallback.
- Internal matches can be deleted from the admin panel.
- Create Match is guarded against duplicate rapid submissions.
- Internal archive cards use stable pastel comic colours with spacing between repeated colour families.
- Internal admin form typography and small-text contrast were cleaned up for both themes.
- Landing presenter label is `The Host presents`.


## ITB16.1 changes

- New custom matches are created with `custom-XXXXX-` IDs and are shown in the same match archive grid as D1/D2.
- Creating a match no longer provides a direct Viewer/Scorer launch from Admin Mode; return through Home → Matches.
- The Start Match action is Firebase-first and verified: the match must be saved with its toss, first innings and live state before the scorer switches to the live desk.
- Custom match object updates merge with the existing full match record so team, player, label and metadata cannot be accidentally wiped by a status/innings update.
- Custom matches now use the same `matches/{id}` live Firebase record path as demo matches.
- New custom IDs use `custom-XXXXX-` followed by a randomized seven-character sequence containing exactly 3 letters and 4 numbers.
- Internal legacy `ITB11-...` IDs remain supported.
- Custom scorer setup now records toss winner, toss decision, batting/bowling sides, opening batters and opening bowler before the first delivery. Drafts do not show the GLC27 pace/spin control yet.
- Second innings has an explicit opening-player setup before scoring resumes.
- Internal match archive filtering recognizes both legacy and new custom IDs.


## ITB16.2 changes

- GitHub Pages clean URLs are available without `.html`, including `/GLC27`, `/GLC27/programme`, `/GLC27/matches`, `/GLC27/match`, `/GLC27/scorer`, `/GLC27/settings`, and `/GLC27/about`.
- Existing `.html` entry pages remain available for backward compatibility.
- About now includes an ITB release-notes panel covering v12 through v16.2.
- Navigation and match/scorer links now use the clean routes.

## ITB17 changes

- Added an installable PWA shell with a manifest, standalone display metadata, app icons and a GitHub Pages-aware service worker.
- Added a persistent offline Firebase write queue for scorer state. The latest complete match snapshot is retained locally and retried automatically when connectivity returns.
- Added monotonic per-match revisions and serialized remote writes so rapid ball-by-ball updates are committed in order; older Firebase callbacks are ignored when they cannot represent newer local state.
- Viewer startup now hydrates immediately from its last-known LocalStorage snapshot before attempting Firebase, keeping the viewer usable during temporary network loss.
- Made modal closing consistent: every shared modal responds to Escape, and long release-note content keeps its close control in a sticky header while the body scrolls independently.
- Refined the About page so `THE DRAFTS` is the section kicker and `The official player evaluation point` is the main heading, matching the hierarchy of `The Official Tournament`.
- Added a deterministic project lint gate backed by the TypeScript parser and wired it ahead of the production build in GitHub Actions. This release does not claim third-party ESLint coverage because the environment cannot install new registry packages during offline validation.
