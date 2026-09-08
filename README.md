# GLsiteITB17 — Gala Luxuria Cup 2027 / The *DRAFTS*

Version 17.0 internal test build / publish candidate.

## What is included
- Dark-mode standard cards use the dark surface with light text.
- Long popups clear the sticky navigation; close controls remain visible while content scrolls.
- Incoming-batter flow has an explicit no-replacement path when no eligible player remains.
- Toasts render above popup/backdrop layers.
- Offline state is handled without crashing: buttons grey out and a top-centre connection notice appears. Modal close/cancel controls remain usable so the UI cannot trap the user.
- Free-hit state persists through wides and other illegal deliveries and expires on the next legal delivery.
- Reduced Motion removes hover/press/page/modal animation and the halftone pointer field; it defaults on mobile/coarse-pointer devices unless the user has already saved a setting.
- Firebase Realtime Database is wired to `matches/{matchId}` for live scorer/viewer synchronisation.
- GitHub Pages deployment workflow is included.
- Firebase Hosting configuration is included.

## Local development
`npm install`
`npm run dev`

## Build
`npm run build`
`npm run preview`

## GitHub Pages
Push the repository to GitHub, keep the default branch as `main`, and enable **Settings → Pages → GitHub Actions**. The included workflow builds `dist/` and deploys it.

GitHub Pages builds use `/GLC27/` as the production base. The public site therefore supports the clean homepage at `https://mddude11.github.io/GLC27` plus extensionless routes such as `/GLC27/programme`, `/GLC27/matches`, `/GLC27/match`, `/GLC27/scorer`, `/GLC27/settings`, and `/GLC27/about`. The legacy `.html` entry pages remain available.

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
