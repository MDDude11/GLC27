# GLsiteITB11 — Gala Luxuria Cup 2027 / The *DRAFTS*

Version 11 internal test / publish candidate.

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


## v11 internal admin

Settings contains a restricted Admin Mode at the bottom. The development fallback password is `DRAFTSADMIN11`; set `VITE_ADMIN_PASSWORD` before publishing to use your own password. The GitHub Pages workflow reads the GitHub Actions secret `VITE_ADMIN_PASSWORD`. This is a client-side gate, not secure authentication, because a static-site password is present in the browser bundle after build.

Internal matches use Firebase Realtime Database under `/internalMatches/<matchId>` and are deliberately separate from the official GLC27 `/matches/<matchId>` namespace. Each internal match stores its custom 3v3 teams, delivery log, and a `playerStats` snapshot including batting runs/balls/fours/sixes/highest score/strike rate, bowling overs/runs/wickets/wides/no-balls/economy, and fielding catches/run-outs/stumpings.

GitHub Pages can serve the Vite build output from `dist`; Firebase Hosting uses `firebase.json` and the same static build.
