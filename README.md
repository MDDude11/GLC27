# GLsiteITB16 — Gala Luxuria Cup 2027 / The *DRAFTS*

Version 16 internal test build / publish candidate.

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

The Vite build uses relative asset paths, so the site works from a GitHub Pages project URL rather than requiring root-relative `/` assets.

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


## ITB16 changes

- New custom matches are created with `custom-XXXXX-` IDs and are shown in the same match archive grid as D1/D2.
- Creating a match no longer provides a direct Viewer/Scorer launch from Admin Mode; return through Home → Matches.
- The Start Match action is Firebase-first and verified: the match must be saved with its toss, first innings and live state before the scorer switches to the live desk.
- Custom match object updates merge with the existing full match record so team, player, label and metadata cannot be accidentally wiped by a status/innings update.
- Custom matches now use the same `matches/{id}` live Firebase record path as demo matches.
- New custom IDs use `custom-XXXXX-` followed by a randomized seven-character sequence containing exactly 3 letters and 4 numbers.
- Internal legacy `ITB11-...` IDs remain supported.
- Custom scorer setup now records toss winner, toss decision, batting/bowling sides, opening batters, opening bowler, and bowling type before the first delivery.
- Second innings has an explicit opening-player setup before scoring resumes.
- Internal match archive filtering recognizes both legacy and new custom IDs.
