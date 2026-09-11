import { useEffect, useState } from "react";
import { MATCHES, MAX_OVERS, MAX_WICKETS, SUPER_OVER_MAX_OVERS, SUPER_OVER_MAX_WICKETS, scorerPath, TEAMS, sitePath, loadSettings, isStandalonePWA, isAndroid } from "./data.js";
import { computeInnings, activeBatters, currentBowler, repairLiveForTeams } from "./engine.js";
import { getMatch, resolveMatchFixture } from "./store.js";
import { subscribeFirebaseMatch } from "./firebase.js";
import { SiteFrame, ComicTitle, TeamBadge, Commentary, PlayerStats, ScorecardModal, Modal, WicketCount } from "./components.jsx";

const originFromEvent = (event) => {
  const r = event?.currentTarget?.getBoundingClientRect?.();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};
const deliveryList = (value = []) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value).filter(([, d]) => d != null);
  if (entries.length > 1 && entries.every(([key]) => /^\d+$/.test(key))) entries.sort(([a], [b]) => Number(a) - Number(b));
  return entries.map(([, d]) => d);
};
const normalise = (match, fallback = {}) => ({
  ...fallback,
  ...(match || {}),
  manualAdjustments: { main: {}, superOvers: [], ...(fallback?.manualAdjustments || {}), ...(match?.manualAdjustments || {}), main: { ...(fallback?.manualAdjustments?.main || {}), ...(match?.manualAdjustments?.main || {}) }, superOvers: Array.isArray(match?.manualAdjustments?.superOvers) ? match.manualAdjustments.superOvers.map((entry) => ({ ...(entry || {}) })) : (Array.isArray(fallback?.manualAdjustments?.superOvers) ? fallback.manualAdjustments.superOvers : []) },
  innings: Array.isArray(match?.innings) ? match.innings.map((inn) => ({ ...inn, deliveries: deliveryList(inn?.deliveries) })) : [],
  superOvers: Array.isArray(match?.superOvers) ? match.superOvers.map((stage, index) => repairLiveForTeams({ ...stage, index: index + 1, innings: Array.isArray(stage?.innings) ? stage.innings.map((inn) => ({ ...inn, deliveries: deliveryList(inn?.deliveries) })) : [], live: { retiredHurt: [], ...(stage?.live || {}) } }, match?.teams || TEAMS)) : [],
  live: { striker: "", nonStriker: "", bowler: "", previousBowler: "", freeHit: false, retiredHurt: [], ...(match?.live || {}) }
});

export default function ViewerPage({ matchId }) {
  const [fixture, setFixture] = useState(() => MATCHES[matchId] || null);
  const [loading, setLoading] = useState(!MATCHES[matchId]);
  const [state, setState] = useState(() => normalise(getMatch(matchId), { status: "upcoming" }));
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [scorecardOrigin, setScorecardOrigin] = useState(null);
  const [commentaryOpen, setCommentaryOpen] = useState(false);
  const [commentaryOrigin, setCommentaryOrigin] = useState(null);
  const canPinLive = isStandalonePWA() && isAndroid() && loadSettings().pinLiveScores;
  const [pinLive, setPinLive] = useState(() => canPinLive && localStorage.getItem(`glt_pinned_match_${matchId}`) === "1");

  useEffect(() => {
    let active = true;
    if (MATCHES[matchId]) {
      setFixture(MATCHES[matchId]);
      setState(normalise(getMatch(matchId), MATCHES[matchId]));
      setLoading(false);
      return () => { active = false; };
    }
    void resolveMatchFixture(matchId).then((resolved) => {
      if (!active) return;
      setFixture(resolved);
      setState(normalise(resolved || getMatch(matchId)));
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [matchId]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    void subscribeFirebaseMatch(matchId, (remote) => {
      if (!active || !remote) return;
      const nextFixture = { ...remote, id: remote.id || matchId, label: remote.label || remote.id || matchId, t1: remote.t1 || "A", t2: remote.t2 || "B", teams: remote.teams || {} };
      setFixture((current) => current || nextFixture);
      setState(normalise(remote, nextFixture));
      setLoading(false);
    }, (error) => console.warn(`Live viewer subscription failed for ${matchId}.`, error)).then((fn) => { if (active && typeof fn === "function") unsubscribe = fn; });
    return () => { active = false; unsubscribe?.(); };
  }, [matchId]);

  const innings = Array.isArray(state.innings) ? state.innings : [];
  const current = innings.at(-1);
  const mainAdjustments = state.manualAdjustments?.main || {};
  const score = current ? computeInnings(current.deliveries || [], { manualAdjustment: Number(mainAdjustments[current.battingTeam]) || 0 }) : null;
  const first = innings[0] ? computeInnings(innings[0].deliveries || [], { manualAdjustment: Number(mainAdjustments[innings[0].battingTeam]) || 0 }) : null;
  const target = innings.length > 1 && first ? first.runs + 1 : null;
  const rr = score?.legal ? (score.runs / (score.legal / 6)).toFixed(2) : "0.00";
  const requiredRuns = target != null && score ? Math.max(0, target - score.runs) : null;
  const ballsLeft = score ? Math.max(0, MAX_OVERS * 6 - score.legal) : 0;
  const reqRR = requiredRuns != null && ballsLeft ? (requiredRuns / (ballsLeft / 6)).toFixed(2) : "—";
  const viewerTeams = fixture?.teams && typeof fixture.teams === "object" ? fixture.teams : TEAMS;
  const team1 = fixture?.t1 || Object.keys(viewerTeams)[0] || "A";
  const team2 = fixture?.t2 || Object.keys(viewerTeams)[1] || "B";
  const statusText = state.finalResult?.winner ? `${state.finalResult.winner} WINS` : state.status === "upcoming" ? "NOT STARTED" : state.status === "innings2" ? "INNINGS BREAK" : state.status === "completed" ? "COMPLETED" : "LIVE";
  const headline = state.finalResult?.winner ? `${state.finalResult.winner} wins` : state.status === "completed" ? (state.result?.winner === "tie" ? "Match tied" : `${state.result?.winner || "Match"} wins`) : `${viewerTeams?.[team1]?.name || team1} vs ${viewerTeams?.[team2]?.name || team2}`;
  const superOvers = state.superOvers || [];
  const latestStage = superOvers.at(-1);
  const latestStageResult = latestStage?.result || (latestStage?.innings?.length >= 2 ? { winner: computeInnings(latestStage.innings[1].deliveries, { maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS, manualAdjustment: Number(latestStage.manualAdjustments?.[latestStage.innings[1].battingTeam]) || 0 }).runs === computeInnings(latestStage.innings[0].deliveries, { maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS, manualAdjustment: Number(latestStage.manualAdjustments?.[latestStage.innings[0].battingTeam]) || 0 }).runs ? "tie" : "" } : null);
  const canBeginSuper = state.result?.winner === "tie" && !superOvers.length || latestStageResult?.winner === "tie";
  const nextSuper = superOvers.length + 1;

  useEffect(() => {
    if (!pinLive || !canPinLive || !state) return;
    const send = async () => {
      try {
        const registration = await navigator.serviceWorker?.ready;
        registration?.active?.postMessage({ type: "LIVE_SCORE", matchId, title: `GLC27 — ${fixture?.label || matchId}`, body: score ? `${team1} ${score.runs}/${score.wickets} (${score.overs}.${score.balls}) • ${team2}` : "Match not started", icon: sitePath("/assets/glc27-favicon.png") });
      } catch {}
    };
    void send();
  }, [pinLive, canPinLive, matchId, fixture, score?.runs, score?.wickets, score?.overs, score?.balls, team1, team2]);

  const togglePinLive = async () => {
    if (!canPinLive) return;
    try {
      const permission = (typeof Notification !== "undefined" && Notification.permission === "granted") ? "granted" : (typeof Notification !== "undefined" ? await Notification.requestPermission() : "denied");
      if (permission !== "granted") return;
      const next = !pinLive;
      setPinLive(next);
      localStorage.setItem(`glt_pinned_match_${matchId}`, next ? "1" : "0");
      const registration = await navigator.serviceWorker?.ready;
      registration?.active?.postMessage(next ? { type: "LIVE_SCORE", matchId, title: `GLC27 — ${fixture?.label || matchId}`, body: score ? `${team1} ${score.runs}/${score.wickets} (${score.overs}.${score.balls}) • ${team2}` : "Match not started", icon: sitePath("/assets/glc27-favicon.png") } : { type: "LIVE_SCORE_CLEAR", matchId });
    } catch {}
  };

  if (loading) return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">INTERNAL MATCH</span><ComicTitle as="h2">Loading match…</ComicTitle><p>Fetching the match record from Firebase.</p></section></main></SiteFrame>;
  if (!fixture) return <NotFound />;

  return <SiteFrame active="matches"><main className="section-wrap page-section viewer-page match-experience-page">
    <div className="page-heading"><div><p className="eyebrow">PUBLIC MATCH VIEWER / {fixture.label}</p><ComicTitle>{headline}</ComicTitle></div><div className="viewer-heading-actions"><span className="format-stamp">{fixture.date} / {fixture.time}</span>{canPinLive && <button type="button" className={`pin-live-button ${pinLive ? "is-pinned" : ""}`} onClick={togglePinLive} aria-pressed={pinLive} title={pinLive ? "Stop live score notification" : "Pin live score"}>⌖ {pinLive ? "PINNED" : "PIN LIVE"}</button>}</div></div>
    <section className="match-view-hero comic-panel dark-panel"><div className="viewer-team"><TeamBadge code={team1} large teams={viewerTeams} /><b>{viewerTeams?.[team1]?.name || team1}</b><span>TEAM</span></div><div className="viewer-score"><span className={`score-state state-${state.status}`}>{statusText}</span><strong>{score ? <>{score.runs}/<WicketCount wickets={score.wickets} deliveries={current?.deliveries || []} retiredHurt={state.live?.retiredHurt || []} /></> : "—"}</strong><span>{score ? `${score.overs}.${score.balls} / ${MAX_OVERS} overs` : "3V3 / 6 OV / 3 WKTS"}</span></div><div className="viewer-team"><TeamBadge code={team2} large teams={viewerTeams} /><b>{viewerTeams?.[team2]?.name || team2}</b><span>TEAM</span></div></section>

    {score ? <>
      <section className="viewer-stats-grid"><Stat label="RUN RATE" value={rr} note="current innings" /><Stat label="REQUIRED RUNS" value={requiredRuns == null ? "—" : requiredRuns} note={target ? `target ${target}` : "first innings"} /><Stat label="REQ. RUN RATE" value={reqRR} note={target ? `${ballsLeft} legal balls left` : "chase not started"} /><Stat label="STATUS" value={statusText} note={state.finalResult?.desc || state.result?.desc || `${score.overs}.${score.balls} / ${MAX_OVERS} overs`} /></section>
      <section className="viewer-live-grid"><article className="comic-panel paper-panel viewer-card"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">AT THE CREASE</span><ComicTitle as="h2">Live batters</ComicTitle></div></div><div className="viewer-players">{activeBatters(state).length ? activeBatters(state).map(([name, p], index) => <div className="viewer-player" key={`${name}-${index}`}><span className="role-tag">{name === state.live.striker ? "STRIKER" : "NON-STRIKER"}</span><b>{name}</b><strong>{p.runs}<small> ({p.balls})</small></strong><span>{p.fours} fours · {p.sixes} sixes</span></div>) : <div className="empty-state">No active batter figures.</div>}</div></article><article className="comic-panel paper-panel viewer-card"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">BOWLING</span><ComicTitle as="h2">Current spell</ComicTitle></div></div>{currentBowler(state) ? <div className="bowler-feature"><span className="role-tag">BOWLER</span><b>{currentBowler(state)[0]}</b><strong>{Math.floor(currentBowler(state)[1].balls / 6)}.{currentBowler(state)[1].balls % 6} <small>OV</small></strong><span>{currentBowler(state)[1].runs} runs · {currentBowler(state)[1].wickets} wickets</span></div> : <div className="empty-state">No bowler selected.</div>}</article></section>
      <PlayerStats state={state} teamCodes={[team1, team2]} teams={viewerTeams} mode="viewer" />
      <section className="viewer-columns"><article className="comic-panel dark-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary</ComicTitle></div><button className="expand-button viewer-family" onClick={(e) => { setCommentaryOrigin(originFromEvent(e)); setCommentaryOpen(true); }}>Expand ↗</button></div><div className="compact-secondary-row"><span className="compact-secondary-row__title">COMMENTARY</span><button className="expand-button viewer-family" onClick={() => setCommentaryOpen(true)}>Expand ↗</button></div></article><article className="comic-panel paper-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">MATCH SCORECARD</span><ComicTitle as="h2">Scorecard</ComicTitle></div><button className="expand-button scorecard-family" onClick={(e) => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); }}>Open ↗</button></div><div className="compact-secondary-row"><span className="compact-secondary-row__title">SCORECARD</span><button className="expand-button scorecard-family" onClick={() => setScorecardOpen(true)}>Open ↗</button></div></article></section>
    </> : <section className="future-note comic-panel paper-panel"><span className="panel-kicker">WAITING FOR PLAY</span><ComicTitle as="h2">Match not started.</ComicTitle><p>The public viewer will populate automatically when play begins.</p><a className="comic-button primary" href={scorerPath(matchId)}>Open scorer <span>→</span></a></section>}

    {(innings.length || superOvers.length) > 0 && <section className="comic-panel paper-panel progression-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">MATCH PROGRESSION</span><ComicTitle as="h2">Main match + Super Overs</ComicTitle></div></div><div className="super-over-timeline"><StageBlock label="MAIN MATCH" innings={innings} teams={viewerTeams} maxOvers={MAX_OVERS} maxWickets={MAX_WICKETS} result={state.result} manualAdjustments={mainAdjustments} />{superOvers.map((stage, index) => <StageBlock key={`viewer-super-${index}`} label={`SUPER OVER ${index + 1}`} innings={stage.innings || []} teams={viewerTeams} maxOvers={SUPER_OVER_MAX_OVERS} maxWickets={SUPER_OVER_MAX_WICKETS} result={stage.result} manualAdjustments={stage.manualAdjustments || state.manualAdjustments?.superOvers?.[index] || {}} />)}</div>{canBeginSuper && <div className="result-actions"><a className="comic-button primary super-over-button" href={scorerPath(matchId, nextSuper)}>BEGIN SUPER OVER{nextSuper > 1 ? ` ${nextSuper}` : ""} ↗</a><button className="central-scorecard-button" onClick={(e) => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); }}>VIEW SCORECARD ↗</button></div>}</section>}

    <div className="viewer-footer-actions"><a className="comic-button tertiary" href={sitePath("/matches")}>← Back to matches</a><a className="comic-button secondary" href={scorerPath(matchId)}>Scorer access ↗</a></div>
    {commentaryOpen && <Modal origin={commentaryOrigin} onClose={() => setCommentaryOpen(false)} className="commentary-modal dark-panel" ariaLabel="Commentary archive"><div className="modal-heading"><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary archive</ComicTitle></div><button className="expand-button close-button" onClick={() => setCommentaryOpen(false)}>Close ×</button></div><div className="modal-scroll-content commentary-modal-scroll"><Commentary deliveries={current?.deliveries || []} /></div></Modal>}
    {scorecardOpen && <ScorecardModal innings={innings} superOvers={superOvers} origin={scorecardOrigin} onClose={() => setScorecardOpen(false)} manualAdjustments={state.manualAdjustments || { main: {}, superOvers: [] }} />}
  </main></SiteFrame>;
}

function StageBlock({ label, innings, teams, maxOvers, maxWickets, result, manualAdjustments = {} }) {
  return <div className="super-over-stage"><div className="super-over-stage__label">{label}</div><div className="result-scores">{innings.map((inn, index) => { const c = computeInnings(deliveryList(inn.deliveries), { maxOvers, maxWickets, manualAdjustment: Number(manualAdjustments?.[inn.battingTeam]) || 0 }); return <div key={`${label}-${index}`}><TeamBadge code={inn.battingTeam} teams={teams} /><strong>{c.runs}/{c.wickets}</strong><span>({c.overs}.{c.balls})</span></div>; })}</div>{result?.winner && <small>{result.winner === "tie" ? "TIED" : `${result.winner} WON`}</small>}</div>;
}
function Stat({ label, value, note }) { return <article className="viewer-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function NotFound() { return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">404 / MATCH NOT FOUND</span><ComicTitle as="h2">That fixture does not exist.</ComicTitle><p>Use the match archive to open a valid public viewer.</p><a className="comic-button primary" href={sitePath("/matches")}>Back to matches ↗</a></section></main></SiteFrame>; }
