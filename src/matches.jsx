import { useEffect, useMemo, useState } from "react";
import { MATCHES, matchPath, scorerPath } from "./data.js";
import { fixtureFromInternalMatch } from "./admin.js";
import { getMatch, listInternalMatches, resetMatch, useLiveMatchState } from "./store.js";
import { subscribeFirebaseInternalMatches } from "./firebase.js";
import { SiteFrame, ComicTitle, TeamBadge, ScoreMini } from "./components.jsx";

const INTERNAL_CARD_PALETTE = [
  { bg: "#ffd7cf", group: "coral" },
  { bg: "#d9efff", group: "sky" },
  { bg: "#eef7b0", group: "lime" },
  { bg: "#e5d8ff", group: "lavender" },
  { bg: "#ffe0b9", group: "peach" },
  { bg: "#d7f2df", group: "mint" },
  { bg: "#ffd7e7", group: "rose" },
  { bg: "#d9e1ff", group: "periwinkle" },
  { bg: "#f7e3a8", group: "butter" },
  { bg: "#d6f1ed", group: "aqua" },
  { bg: "#e9dcf5", group: "lilac" },
  { bg: "#f0decf", group: "sand" },
];

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assignInternalCardThemes(fixtures) {
  const recentGroups = [];
  const themes = {};

  for (const fixture of fixtures) {
    const start = stableHash(fixture.id) % INTERNAL_CARD_PALETTE.length;
    let chosen = null;

    for (let offset = 0; offset < INTERNAL_CARD_PALETTE.length; offset += 1) {
      const candidate = INTERNAL_CARD_PALETTE[(start + offset) % INTERNAL_CARD_PALETTE.length];
      if (!recentGroups.includes(candidate.group)) {
        chosen = candidate;
        break;
      }
    }

    chosen ||= INTERNAL_CARD_PALETTE[start];
    themes[fixture.id] = chosen;
    recentGroups.push(chosen.group);
    if (recentGroups.length > 8) recentGroups.shift();
  }

  return themes;
}

function MatchCard({ fixture, index, internal = false, cardTheme = null }) {
  const [state, setState] = useState(() => getMatch(fixture.id));
  useEffect(() => useLiveMatchState(fixture.id, setState), [fixture.id]);
  const status = state.status === "upcoming" ? "READY" : state.status === "innings2" ? "INNINGS BREAK" : state.status.toUpperCase();
  const cardStyle = internal && cardTheme ? { "--internal-card-bg": cardTheme.bg } : undefined;
  return <article className={`match-card match-card-${index + 1} ${internal ? "internal-match-card" : ""}`} style={cardStyle}>
    <div className="match-card-top"><span>{fixture.label}</span><span>{fixture.date}</span></div>
    <div className="match-teams">
      <div className="team-side"><TeamBadge code={fixture.t1} large teams={fixture.teams || undefined} /><b>{fixture.teams?.[fixture.t1]?.name || fixture.t1}</b></div>
      <span className="versus">VS</span>
      <div className="team-side"><TeamBadge code={fixture.t2} large teams={fixture.teams || undefined} /><b>{fixture.teams?.[fixture.t2]?.name || fixture.t2}</b></div>
    </div>
    <div className="score-mini"><ScoreMini state={state} fixture={fixture} /></div>
    <div className="match-card-bottom"><span className={`status status-${state.status}`}>{status}</span><span>{fixture.time}{fixture.venue ? ` · ${fixture.venue}` : ""}</span></div>
    <div className="card-actions"><a className="comic-button viewer-card-button" href={matchPath(fixture.id)}>Open viewer ↗</a><a className="comic-button scorer-card-button" href={scorerPath(fixture.id)}>Scorer ↗</a></div>
    {!internal && <button className="text-reset" onClick={() => { if (window.confirm(`Reset ${fixture.label}?`)) resetMatch(fixture.id); }}>Reset demo</button>}
  </article>;
}

export default function MatchesPage() {
  const [internalMatches, setInternalMatches] = useState({});
  const [internalLoading, setInternalLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    void listInternalMatches().then((all) => {
      if (active) {
        setInternalMatches(all || {});
        setInternalLoading(false);
      }
    }).catch(() => {
      if (active) setInternalLoading(false);
    });

    void subscribeFirebaseInternalMatches((all) => {
      if (!active) return;
      setInternalMatches(all || {});
      setInternalLoading(false);
    }, () => {
      if (active) setInternalLoading(false);
    }).then((unsub) => {
      if (!active) unsub?.();
      else if (typeof unsub === "function") unsubscribe = unsub;
    });

    const refresh = () => {
      void listInternalMatches().then((all) => { if (active) setInternalMatches(all || {}); });
    };
    window.addEventListener("glt-internal-match-updated", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      unsubscribe?.();
      window.removeEventListener("glt-internal-match-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const internalFixtures = useMemo(() => Object.values(internalMatches)
    .map(fixtureFromInternalMatch)
    .filter(Boolean)
    .sort((a, b) => `${b.date} ${b.time} ${b.id}`.localeCompare(`${a.date} ${a.time} ${a.id}`)), [internalMatches]);
  const internalCardThemes = useMemo(
    () => assignInternalCardThemes(internalFixtures),
    [internalFixtures]
  );

  return <SiteFrame active="matches">
    <main className="section-wrap page-section">
      <div className="page-heading"><div><p className="eyebrow">THE DRAFTS / MATCH ARCHIVE</p><ComicTitle>Current <i>matches.</i></ComicTitle></div><span className="format-stamp">3V3 / 6 OV / 3 WKTS</span></div>
      <div className="match-grid">{Object.values(MATCHES).map((fixture, index) => <MatchCard key={`fixture-${fixture.id}`} fixture={fixture} index={index} />)}</div>

      <section className="internal-match-section" aria-label="Internal test matches">
        <div className="internal-match-divider"><span>INTERNAL TEST MATCHES</span><i /><small>LIVE / FIREBASE</small></div>
        {internalLoading && !internalFixtures.length ? <div className="empty-state internal-match-loading">Loading internal matches…</div> : null}
        {!internalFixtures.length && !internalLoading ? <div className="empty-state">No internal matches have been created yet.</div> : null}
        {internalFixtures.length ? <div className="match-grid internal-match-grid">{internalFixtures.map((fixture, index) => <MatchCard key={`internal-${fixture.id}`} fixture={fixture} index={index} internal cardTheme={internalCardThemes[fixture.id]} />)}</div> : null}
      </section>
    </main>
  </SiteFrame>;
}
