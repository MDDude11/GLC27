# ITB v23 — App shell, release-history, scorer layout and PWA controls

## v23.0.0
- Removed the bat-and-ball section from the homepage while keeping the coded artwork available in the project for future reuse.
- Standardized all modal dialogs on a centered fixed viewport frame with internal scrolling and anchored headers/actions.
- Restored the full ITB release-history timeline through v1 and changed Release Notes to reveal the latest five entries first, with SHOW PREVIOUS paging back five at a time.
- Added the App section to the navbar with app version v1.1.0 and device/PWA controls for themed browser chrome, fast mode, fullscreen, notifications, wake lock, reduced background effects, startup behavior and scorer safety.
- Added Android PWA live-score pin controls on Match Viewer screens and service-worker live-score notifications.
- Fixed the current-over ball strip to use uniform spacing and a larger mobile viewing area.
- Reworked WIDE and NO BALL into one-row morphing option groups with equal-size cells and no wrapping.
- Improved light-mode selection controls and PWA theme-color metadata.

# ITB v22.9.1 — Code-drawn landing artwork

## v22.9.1
- Removed the supplied landing artwork image from the homepage entirely.
- Recreated the approved bat-and-ball composition as inline SVG/CSS inside `home.jsx`, including the bat, dark grip, blue/gold detail, dotted background, burst rays, GLC27 badge and neon green COSCO tennis ball.
- The new artwork is vector-scaled and remains decorative/out of document flow, so it cannot expand the homepage from image intrinsic dimensions.
- Bumped the PWA shell/cache identifier for v22.9.1.

## v22.9.0
- Fixed the supplied bat-and-ball artwork taking the full intrinsic 950×1655 image height and expanding the landing-page grid.
- The artwork now behaves as a bounded decorative graphic positioned inside the hero art region, so it no longer pushes content down or breaks the page layout.
- Preserved the exact supplied artwork asset and its proportions across desktop, tablet and mobile layouts.
- Bumped the PWA shell/cache identifier and offline write-queue key for clean v22.9 delivery.

# ITB v22.8.5 — PWA chrome, offline navigation, visual system and scorer polish

## v22.8.5
- Matched browser/PWA theme metadata to the active accent where supported and made installed-app icons use the supplied Gala Luxuria Cup 2027 crest.
- Kept local navigation available offline while retaining the existing queued-write path for network-dependent match actions.
- Added theme-aware pull-to-refresh metadata where browser chrome supports it.
- Replaced the homepage bat-and-ball graphic with the exact supplied comic artwork and green COSCO tennis ball.
- Added Cobalt, Scarlet and Teal as fresh accent themes.
- Replaced Large text with a continuous `step="any"` Text Size slider.
- Applied custom comic scrollbars to the main page and popup scroll surfaces.
- Refined setup cards to the approved sharp rectangular treatment and kept light-mode selects light and readable.
- Removed the stray bottom band from the manual score adjustment popup.
- Replaced the OVER/LEGAL/LEGAL BALL box with a themed current-over delivery result strip.
- Cleaned up Retired Out sole-batter state so no stale incoming-batter popup remains when no replacement is available.

# ITB v22.8 — Standalone state, themed controls, popup polish and crest update

## v22.8.0
- Applied the eight v22.6 fixes as the v22.8 release: standalone batting state repair, themed setup controls, popup header anchoring/condensation, timed REDO, Retired Out no-incoming handling, full crest branding and homepage carousel timing.
- Added custom theme-aware scrollbars across the site and scrollable modal/panel surfaces.
- Reworked all modal scroll detection to listen to the actual scrolling descendant so popup headers condense reliably across normal and compact mode.
- Added a 10-second REDO window after Undo; a new action invalidates the pending redo.
- Hardened sole-remaining-batter state so scoring does not demand a nonexistent non-striker after wicket/retirement transitions.
- Retired Out now enters the solo-batter path when no eligible replacement remains instead of forcing an incoming-batter popup.
- Replaced the small GLC27 header mark with the supplied full Gala Luxuria Cup 2027 crest.
- Changed homepage rotation to 4 seconds for normal lines and 10 seconds for **STEAMING FURY**.
- Kept Sound effects explicitly OFF by default and advanced the settings migration for this release.

# GLC27 ITB Patch Notes

## v22.6.0 — Setup theming + interaction sound repair

### Setup control theming
- Fixed the scorer setup `<select>` controls showing as browser-default black/dark fields with oversized native arrows instead of the GLC visual language.
- Added a theme-aware custom dropdown arrow, readable selected-value styling, consistent borders/shadows, and appropriate colour-scheme handling for light and dark themes.
- Applied the same treatment to opening-player setup, second-innings setup and Super Over setup.

### Interaction sound
- Reworked the click cue so the browser AudioContext is resumed from the initiating user gesture before tones are scheduled.
- Increased the cue to an intentionally audible but still brief two-note comic tick.
- Kept Sound effects **OFF by default** and versioned the sound migration again so stale v22.5 state cannot leave the toggle incorrectly presented as on.
- The Settings toggle remains the single source of truth for whether interaction audio plays.

No scoring rules, Firebase schema or match-lifecycle semantics were intentionally changed.

## v22.5.0 — Theme + sound + undo refinement

### Theme consistency
- Updated scorer/setup controls to inherit the active site theme instead of using legacy light/default fills.
- Team-derived cards, toss controls and player selectors now share the active surface, accent, border, shadow and focus treatment.
- Kept the treatment consistent across light/dark presentation and all accent choices.

### Interaction sound
- Made Sound effects explicitly **OFF by default** with a one-time migration for existing settings that retained the previous incorrect/default-on state.
- Kept the click tune fully controlled by the Settings toggle.
- Tuned the cue so it is actually audible when enabled while remaining short and unobtrusive.

### Undo checkpoints
- When Undo restores a state that requires a mandatory player choice, the popup now identifies that it was reached because of Undo and provides **RESUME UNDOING**.
- RESUME UNDOING continues through the next history checkpoint instead of forcing the same mandatory choice again.
- Applied this to incoming-batter replacement and Retired Hurt return checkpoints, with the same checkpoint mechanism ready to cover additional mandatory-choice states.
- Ordinary mandatory choices opened by normal scoring/actions do not show RESUME UNDOING.

No ordinary scoring rules, Firebase schema or match lifecycle semantics were intentionally changed.

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
