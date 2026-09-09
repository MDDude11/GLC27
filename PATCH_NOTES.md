# GLC27 ITB Patch Notes

## v22.0.0 — Scorer controls, popup polish and state reliability

### Standalone batting state
- Fixed the live-state/scoring mismatch after **2 wickets**, or **1 wicket + 1 retirement**, where the sole remaining batter could be shown as standalone but scoring still demanded a non-striker.
- Standalone status now follows the actual number of eligible remaining batters.

### Manual score overrides
- Added **EDIT MANUALLY** at the bottom of the scorer.
- Supports **+1, +2, +5, -5, -2 and -1**.
- The scorer chooses either team before applying the adjustment.
- Adjustments affect displayed team scores and result calculations without becoming a delivery and without changing batter, ball, wicket or bowler figures.

### Popup headers
- Popup headers now condense as the popup's scrollable content moves.
- This applies in **normal mode and compact mode**.

### Click sound
- Added a short UI click tune for interactive controls.
- The existing **Sound effects** setting now controls the sound.
- Sound is **off by default**, including migration from earlier settings where the old default was on.

### Favicon
- Added the supplied Gala Luxuria Cup 2027 emblem as the browser favicon across the site's HTML entry points.

### Demo reset protection
- **RESET DEMO** in matches.html now requires the scorer password **DRAFTS27** before reset confirmation.

### UI polish
- Added a compact official-tools treatment around manual score editing.
- Refreshed the v22 PWA shell/cache version.

## v21.0.0 — Incoming batter + halftone interaction fix

### Incoming batter fix
- Fixed the **Bring in** flow after a wicket or retirement.
- The popup now keeps a stable eligible-player list and passes the selected batter directly into the commit handler.
- Removed the stale React-state validation race that could show **Please select a new batsman** even though the user had already selected one.
- Added a final live-state availability check immediately before writing the replacement batter.
- Applied the fix to both the main match and every recursive Super Over stage.

### Halftone dots
- Changed pointer interaction so the original background dot grows in place.
- Removed the positional pull that could make the enlarged state look like a second dot.
- Removed the destination-out/repaint approach that could visually read as a duplicate dot.
- The enlarged dot now shares the exact original dot coordinates throughout the interaction.

### Release shell
- Bumped the service-worker shell cache for v21 so the corrected scorer and background interaction assets are refreshed.
- No intentional changes were made to the underlying wicket, retirement, Firebase schema or ordinary scoring rules.

## v20.0.0 — Match experience + recursive Super Overs

The build previously labelled v21 was formally treated as v20.

### Match and scoring
- Added recursive **Super Over** stages for tied matches and tied Super Overs, with no arbitrary depth limit.
- Kept the main match and every Super Over in the same Firebase match record.
- Added **BEGIN SUPER OVER** beside **VIEW SCORECARD** whenever the current stage is tied.
- Included the complete stage progression and all Super Overs in scorecard views.
- Restored dedicated **RETIRED HURT** and **RETIRED OUT** controls below WIDE.
- Kept the normal WICKET menu limited to genuine dismissals.
- Retired Hurt records no wicket/no bowler wicket, displays a grey H state, and permits return only after two wickets are down.
- Retired Out records an innings wicket but no bowler wicket.
- Hardened incoming-player, duplicate-player and stale-dismissed-player handling.
- Hardened Super Over team derivation and opening-player validation.

### Match interface
- Added true compact information-at-a-glance mode rather than a simple CSS scale-down.
- Added compact live cards, responsive over/ball strip placement, collapsed commentary and scorecard rows, and touch-safe controls.
- Added anchored section headings that condense while scrolling.
- Removed Pace/Spin setup choices.
- Made setup surfaces theme-aware.
- Moved modal layers above the footer/page chrome.
- Refined Programme Drafts hover treatment.
- Refined halftone interaction architecture and viewer production constants.
- Fixed the viewer MAX_WICKETS reference issue.
