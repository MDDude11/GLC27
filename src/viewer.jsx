import { useEffect, useState } from "react";
import { MATCHES, MAX_OVERS, scorerPath, TEAMS } from "./data.js";
import { isInternalMatchId } from "./admin.js";
import { computeInnings, activeBatters, currentBowler } from "./engine.js";
import { getMatch, resolveMatchFixture } from "./store.js";
import { subscribeFirebaseInternalMatch, subscribeFirebaseMatch } from "./firebase.js";
import { SiteFrame, ComicTitle, TeamBadge, Commentary, Scorecard, PlayerStats, ScorecardModal, DetailedStatsModal, Modal, morphOpen, WicketCount } from "./components.jsx";

const originFromEvent = (event) => {
  const r = event?.currentTarget?.getBoundingClientRect?.();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};

export default function ViewerPage({ matchId }) {
  const [fixture, setFixture] = useState(() => MATCHES[matchId] || null);
  const [loading, setLoading] = useState(!MATCHES[matchId]);
  const [state, setState] = useState(() => getMatch(matchId) || { status: "upcoming", innings: [], live: {}, result: null });
  const [commentaryOpen, setCommentaryOpen] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [commentaryOrigin, setCommentaryOrigin] = useState(null);
  const [scorecardOrigin, setScorecardOrigin] = useState(null);

  useEffect(() => {
    let active = true;
    if (MATCHES[matchId]) {
      setFixture(MATCHES[matchId]);
      setState(getMatch(matchId));
      setLoading(false);
      return () => { active = false; };
    }
    void resolveMatchFixture(matchId)
      .then((resolved) => {
        if (!active) return;
        // For internal matches, resolveMatchFixture may have just fetched the
        // authoritative Firebase record. Use that resolved record immediately
        // instead of reading localStorage again, which could still be empty in
        // a public browser that has never opened the scorer/admin pages.
        setFixture(resolved);
        setState(resolved || getMatch(matchId));
        setLoading(false);
      })
      .catch((error) => {
        console.warn(`Unable to load public viewer fixture ${matchId}.`, error);
        if (active) {
          setFixture(null);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [matchId]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    const start = async () => {
      try {
        // Always subscribe directly to the authoritative Firebase record.
        // This is especially important for internal matches because a public
        // viewer on another device may have no matching localStorage record.
        const onRemote = (remoteMatch) => {
          if (!active || !remoteMatch) return;
          setState(remoteMatch);
        };

        const onError = (error) => {
          console.warn(`Live viewer subscription failed for ${matchId}.`, error);
        };

        const maybeUnsubscribe = isInternalMatchId(matchId)
          ? await subscribeFirebaseInternalMatch(matchId, onRemote, onError)
          : await subscribeFirebaseMatch(matchId, onRemote, onError);

        if (!active) {
          maybeUnsubscribe?.();
          return;
        }
        if (typeof maybeUnsubscribe === "function") unsubscribe = maybeUnsubscribe;
      } catch (error) {
        console.warn(`Live viewer subscription could not start for ${matchId}.`, error);
      }
    };

    void start();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [matchId]);

  const innings = Array.isArray(state?.innings) ? state.innings : [];
  const current = innings.at(-1);
  const score = current ? computeInnings(current.deliveries || []) : null;
  const first = innings[0] ? computeInnings(innings[0].deliveries || []) : null;
  const target = innings.length > 1 && first ? first.runs + 1 : null;
  const rr = score?.legal ? (score.runs / (score.legal / 6)).toFixed(2) : "0.00";
  const requiredRuns = target != null && score ? Math.max(0, target - score.runs) : null;
  const ballsLeft = score ? Math.max(0, MAX_OVERS * 6 - score.legal) : 0;
  const reqRR = requiredRuns != null && ballsLeft ? (requiredRuns / (ballsLeft / 6)).toFixed(2) : "—";
  const batters = activeBatters(state);
  const bowler = currentBowler(state);
  const bowlerEconomy = bowler?.[1].balls ? (bowler[1].runs / (bowler[1].balls / 6)).toFixed(2) : "0.00";
  const statusText = state.status === "upcoming" ? "NOT STARTED" : state.status === "innings2" ? "INNINGS BREAK" : state.status === "completed" ? "COMPLETED" : "LIVE";
  const viewerTeams = fixture?.teams && typeof fixture.teams === "object" ? fixture.teams : TEAMS;
  const team1 = fixture?.t1 || Object.keys(viewerTeams)[0] || "A";
  const team2 = fixture?.t2 || Object.keys(viewerTeams)[1] || "B";
  const headline = state.status === "completed"
    ? (state.result?.winner === "tie" ? "Match tied" : `${state.result?.winner || "Match"} wins`)
    : state.status === "innings2"
      ? "Innings break"
      : `${viewerTeams?.[team1]?.name || team1 || "Team A"} vs ${viewerTeams?.[team2]?.name || team2 || "Team B"}`;

  if (loading) return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">INTERNAL MATCH</span><ComicTitle as="h2">Loading match…</ComicTitle><p>Fetching the separate Firebase internal match record.</p></section></main></SiteFrame>;
  if (!fixture) return <NotFound />;

  return <SiteFrame active="matches"><main className="section-wrap page-section viewer-page">
    <div className="page-heading"><div><p className="eyebrow">PUBLIC MATCH VIEWER / {fixture.label}</p><ComicTitle>{headline}</ComicTitle></div><span className="format-stamp">{fixture.date} / {fixture.time}</span></div>
    <section className="match-view-hero comic-panel dark-panel"><div className="viewer-team"><TeamBadge code={team1} large teams={viewerTeams} /><b>{viewerTeams?.[team1]?.name || team1}</b><span>{innings[0]?.battingTeam === team1 ? "Batting first" : "Squad"}</span></div><div className="viewer-score"><span className={`score-state state-${state.status}`}>{statusText}</span><strong>{score ? <>{score.runs}/<WicketCount wickets={score.wickets} deliveries={current?.deliveries || []} /></> : "—"}</strong><span>{score ? `${score.overs}.${score.balls} / ${MAX_OVERS} overs` : "3V3 / 6 OV / 3 WKTS"}</span></div><div className="viewer-team"><TeamBadge code={team2} large teams={viewerTeams} /><b>{viewerTeams?.[team2]?.name || team2}</b><span>{innings[0]?.battingTeam === team2 ? "Batting first" : "Squad"}</span></div></section>

    <section className="viewer-stats-grid"><Stat label="RUN RATE" value={rr} note="current innings" /><Stat label="REQUIRED RUNS" value={requiredRuns == null ? "—" : requiredRuns} note={target ? `target ${target}` : "first innings"} /><Stat label="REQ. RUN RATE" value={reqRR} note={target ? `${ballsLeft} legal balls left` : "chase not started"} /><Stat label="STATUS" value={statusText} note={state.result?.desc || `${score?.overs || 0}.${score?.balls || 0} / ${MAX_OVERS} overs`} /></section>

    {score ? <>
      <section className="viewer-live-grid"><article className="comic-panel paper-panel viewer-card"><div className="panel-heading"><div><span className="panel-kicker">AT THE CREASE</span><ComicTitle as="h2">Live batters</ComicTitle></div><span className="live-chip"><i /> {state.status === "live" ? "LIVE" : "FINAL"}</span></div><div className="viewer-players">{batters.length ? batters.map(([name, p], index) => <div className="viewer-player" key={`viewer-player-${name}-${index}`}><span className="role-tag">{name === state.live.striker ? "STRIKER" : "NON-STRIKER"}</span><b>{name}</b><strong>{p.runs}<small> ({p.balls})</small></strong><span>{p.fours} fours · {p.sixes} sixes</span></div>) : <div className="empty-state">No active batter figures.</div>}</div></article><article className="comic-panel paper-panel viewer-card"><div className="panel-heading"><div><span className="panel-kicker">BOWLING</span><ComicTitle as="h2">Current spell</ComicTitle></div><span className="economy-stamp">ECON {bowlerEconomy}</span></div>{bowler ? <div className="bowler-feature"><span className="role-tag">BOWLER</span><b>{bowler[0]}</b><strong>{Math.floor(bowler[1].balls / 6)}.{bowler[1].balls % 6} <small>OV</small></strong><span>{bowler[1].runs} runs · {bowler[1].wickets} wickets · economy {bowlerEconomy}</span></div> : <div className="empty-state">No bowler selected.</div>}</article></section>
      <section className="viewer-live-strip"><div><span>STRIKER</span><b>{state.live.striker || "—"}</b></div><div><span>NON-STRIKER</span><b>{state.live.nonStriker || "—"}</b></div><div><span>BOWLER</span><b>{state.live.bowler || "—"}</b></div><div><span>TARGET</span><b>{target || "—"}</b></div></section>
      <PlayerStats state={state} teamCodes={[team1, team2]} teams={viewerTeams} mode="viewer" />
      <section className="viewer-columns"><article className="comic-panel dark-panel"><div className="panel-heading"><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary</ComicTitle></div><button className="expand-button viewer-family" onClick={(e) => morphOpen(e, "commentary-morph", () => { setCommentaryOrigin(originFromEvent(e)); setCommentaryOpen(true); })}>Expand ↗</button></div><Commentary deliveries={current?.deliveries || []} limit={6} /></article><article className="comic-panel paper-panel"><div className="panel-heading"><div><span className="panel-kicker">MATCH SCORECARD</span><ComicTitle as="h2">Figures</ComicTitle></div><button className="expand-button scorecard-family" onClick={(e) => morphOpen(e, "scorecard-morph", () => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); })}>Open ↗</button></div><Scorecard innings={innings} /></article></section>
    </> : <section className="future-note comic-panel paper-panel"><span className="panel-kicker">WAITING FOR PLAY</span><ComicTitle as="h2">Match not started.</ComicTitle><p>The public viewer will populate automatically when play begins.</p><a className="comic-button primary" href={scorerPath(matchId)}>Open scorer <span>→</span></a></section>}

    <div className="viewer-footer-actions"><a className="comic-button tertiary" href="./matches.html">← Back to matches</a><a className="comic-button secondary" href={scorerPath(matchId)}>Scorer access ↗</a></div>
    {commentaryOpen && <Modal origin={commentaryOrigin} onClose={() => setCommentaryOpen(false)} className="commentary-modal dark-panel" ariaLabel="Commentary archive" morphName="commentary-morph"><div className="panel-heading"><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary archive</ComicTitle></div><button className="expand-button close-button" onClick={() => setCommentaryOpen(false)}>Close ×</button></div><Commentary deliveries={current?.deliveries || []} /></Modal>}
    {scorecardOpen && <ScorecardModal innings={innings} origin={scorecardOrigin} onClose={() => setScorecardOpen(false)} morphName="scorecard-morph" />}
  </main></SiteFrame>;
}

function Stat({ label, value, note }) { return <article className="viewer-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function NotFound() { return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">404 / MATCH NOT FOUND</span><ComicTitle as="h2">That fixture does not exist.</ComicTitle><p>Use the match archive to open a valid public viewer.</p><a className="comic-button primary" href="./matches.html">Back to matches ↗</a></section></main></SiteFrame>; }
