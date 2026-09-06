import { useEffect, useMemo, useState } from "react";
import { MATCHES, matchPath, scorerPath } from "./data.js";
import { fixtureFromInternalMatch } from "./admin.js";
import { getMatch, listInternalMatches, resetMatch, useLiveMatchState } from "./store.js";
import { subscribeFirebaseInternalMatches } from "./firebase.js";
import { SiteFrame, ComicTitle, TeamBadge, ScoreMini } from "./components.jsx";

function MatchCard({ fixture, index, internal = false }) {
  const [state, setState] = useState(() => getMatch(fixture.id));
  useEffect(() => useLiveMatchState(fixture.id, setState), [fixture.id]);
  const status = state.status === "upcoming" ? "READY" : state.status === "innings2" ? "INNINGS BREAK" : state.status.toUpperCase();
  return <article className={`match-card match-card-${index + 1} ${internal ? "internal-match-card" : ""}`}>
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

  return <SiteFrame active="matches">
    <main className="section-wrap page-section">
      <div className="page-heading"><div><p className="eyebrow">THE DRAFTS / MATCH ARCHIVE</p><ComicTitle>Current <i>matches.</i></ComicTitle></div><span className="format-stamp">3V3 / 6 OV / 3 WKTS</span></div>
      <div className="match-grid">{Object.values(MATCHES).map((fixture, index) => <MatchCard key={`fixture-${fixture.id}`} fixture={fixture} index={index} />)}</div>

      <section className="internal-match-section" aria-label="Internal test matches">
        <div className="internal-match-divider"><span>INTERNAL TEST MATCHES</span><i /><small>LIVE / FIREBASE</small></div>
        {internalLoading && !internalFixtures.length ? <div className="empty-state internal-match-loading">Loading internal matches…</div> : null}
        {!internalFixtures.length && !internalLoading ? <div className="empty-state">No internal matches have been created yet.</div> : null}
        {internalFixtures.length ? <div className="match-grid internal-match-grid">{internalFixtures.map((fixture, index) => <MatchCard key={`internal-${fixture.id}`} fixture={fixture} index={index} internal />)}</div> : null}
      </section>
    </main>
  </SiteFrame>;
}
