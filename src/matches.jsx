import { useEffect, useMemo, useState } from "react";
import { MATCHES, matchPath, scorerPath, SCORER_PASSWORD } from "./data.js";
import { fixtureFromInternalMatch, isInternalMatchId } from "./admin.js";
import { getMatch, listInternalMatches, resetMatch, useLiveMatchState } from "./store.js";
import { subscribeFirebaseMatches } from "./firebase.js";
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
    {!internal && <button className="text-reset" onClick={() => {
      const entered = window.prompt("Admin scorer password required to reset this demo match:");
      if (entered !== SCORER_PASSWORD) {
        if (entered !== null) window.alert("Incorrect scorer password.");
        return;
      }
      if (window.confirm(`Reset ${fixture.label}?`)) resetMatch(fixture.id);
    }}>Reset demo</button>}
  </article>;
}

export default function MatchesPage() {
  const [customMatches, setCustomMatches] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    const refresh = () => {
      void listInternalMatches()
        .then((all) => {
          if (active) {
            setCustomMatches(all || {});
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    };

    refresh();

    void subscribeFirebaseMatches((all) => {
      const filtered = Object.fromEntries(
        Object.entries(all || {}).filter(([id]) => isInternalMatchId(id))
      );
      if (!active) return;
      setCustomMatches(filtered);
      setLoading(false);
    }, () => {
      if (active) setLoading(false);
    }).then((unsub) => {
      if (!active) unsub?.();
      else if (typeof unsub === "function") unsubscribe = unsub;
    });

    window.addEventListener("glt-internal-match-updated", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      unsubscribe?.();
      window.removeEventListener("glt-internal-match-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const customFixtures = useMemo(
    () => Object.values(customMatches)
      .map(fixtureFromInternalMatch)
      .filter(Boolean)
      .sort((a, b) => `${b.date} ${b.time} ${b.id}`.localeCompare(`${a.date} ${a.time} ${a.id}`)),
    [customMatches]
  );

  const allFixtures = useMemo(
    () => [
      ...Object.values(MATCHES).map((fixture) => ({ fixture, internal: false })),
      ...customFixtures.map((fixture) => ({ fixture, internal: true }))
    ],
    [customFixtures]
  );

  const cardThemes = useMemo(
    () => assignInternalCardThemes(customFixtures),
    [customFixtures]
  );

  return <SiteFrame active="matches">
    <main className="section-wrap page-section">
      <div className="page-heading"><div><p className="eyebrow">THE DRAFTS / MATCH ARCHIVE</p><ComicTitle>Current <i>matches.</i></ComicTitle></div><span className="format-stamp">3V3 / 6 OV / 3 WKTS</span></div>
      {loading && !customFixtures.length ? <div className="empty-state internal-match-loading">Refreshing Firebase matches…</div> : null}
      <div className="match-grid">
        {allFixtures.map(({ fixture, internal }, index) => (
          <MatchCard
            key={`${internal ? "custom" : "fixture"}-${fixture.id}`}
            fixture={fixture}
            index={index}
            internal={internal}
            cardTheme={internal ? cardThemes[fixture.id] : null}
          />
        ))}
      </div>
    </main>
  </SiteFrame>;
}
