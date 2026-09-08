import { useEffect, useMemo, useState } from "react";
import { MATCHES, MAX_OVERS, MAX_WICKETS, SCORER_PASSWORD, SCORER_SESSION_KEY, TEAMS, emptyLive, matchPath, sitePath } from "./data.js";
import { clone, computeInnings, describeResult } from "./engine.js";
import { getMatch, patchMatch, commitMatchUpdate, useLiveMatchState, resolveMatchFixture } from "./store.js";
import { SiteFrame, ComicTitle, TeamBadge, Commentary, Scorecard, PlayerStats, ScorecardModal, Modal, morphOpen, WicketCount } from "./components.jsx";

const deliveryList = (value = []) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value).filter(([, delivery]) => delivery != null);
  if (entries.length > 1 && entries.every(([key]) => /^\d+$/.test(key))) {
    entries.sort(([a], [b]) => Number(a) - Number(b));
  }
  return entries.map(([, delivery]) => delivery);
};

const unique = (items) => [...new Set(items.filter(Boolean))];
const DISMISSAL_TYPES = ["Bowled", "Caught", "LBW", "Run Out", "Hit Wicket", "Stumped", "Retired Hurt", "Retired Out"];

function originFromEvent(event) {
  const r = event?.currentTarget?.getBoundingClientRect?.();
  if (!r) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export default function ScorerPage({ matchId }) {
  const [fixture, setFixture] = useState(() => MATCHES[matchId] || null);
  const [loading, setLoading] = useState(!MATCHES[matchId]);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(`${SCORER_SESSION_KEY}_${matchId}`) === "1");
  const [password, setPassword] = useState("");
  useEffect(() => { let active = true; if (MATCHES[matchId]) return undefined; void resolveMatchFixture(matchId).then((resolved) => { if (active) { setFixture(resolved); setLoading(false); } }); return () => { active = false; }; }, [matchId]);
  if (loading) return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">INTERNAL MATCH</span><ComicTitle as="h2">Loading match…</ComicTitle><p>Fetching the match record from Firebase.</p></section></main></SiteFrame>;
  if (!fixture) return <NotFoundScorer />;
  if (!unlocked) return <PasswordGate password={password} setPassword={setPassword} onUnlock={() => setUnlocked(true)} fixture={fixture} />;
  return <ScorerDesk matchId={matchId} fixture={fixture} />;
}

function PasswordGate({ password, setPassword, onUnlock, fixture }) {
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (password === SCORER_PASSWORD) {
      sessionStorage.setItem(`${SCORER_SESSION_KEY}_${fixture.id}`, "1");
      onUnlock();
    } else setError("Incorrect scorer password.");
  };
  return <SiteFrame active="matches"><main className="section-wrap page-section password-page"><section className="password-card comic-panel paper-panel"><span className="panel-kicker">OFFICIALS ONLY / {fixture.label}</span><ComicTitle>Scorer <i>access</i></ComicTitle><p>This page controls the live match.</p><form onSubmit={submit}><label>Scorer password<input autoFocus type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Enter password" /></label>{error && <div className="form-error">{error}</div>}<button className="comic-button primary wide-button" type="submit">Unlock scorer <span>→</span></button></form><a className="back-link" href={matchPath(fixture.id)}>← Return to public viewer</a></section></main></SiteFrame>;
}

function ScorerDesk({ matchId, fixture }) {
  const teams = fixture.teams || TEAMS;
  const [state, setState] = useState(() => getMatch(matchId));
  const [history, setHistory] = useState([]);
  const battingPlayers = teams[fixture.t1]?.players || [];
  const bowlingPlayers = teams[fixture.t2]?.players || [];
  const [setup, setSetup] = useState({
    batting: fixture.t1,
    tossWinner: fixture.t1,
    tossDecision: "bat",
    striker: battingPlayers[0] || "",
    nonStriker: battingPlayers[1] || "",
    bowler: bowlingPlayers[0] || "",
    ballType: "pace"
  });
  const [secondSetup, setSecondSetup] = useState({
    striker: "",
    nonStriker: "",
    bowler: "",
    ballType: "pace"
  });
  const [toast, setToast] = useState("");
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketOrigin, setWicketOrigin] = useState(null);
  const [wicketDraft, setWicketDraft] = useState({ type: "Bowled", dismissed: "", outEnd: "striker", fielder: "" });
  const [newBatsmanOpen, setNewBatsmanOpen] = useState(false);
  const [newBatsmanOrigin, setNewBatsmanOrigin] = useState(null);
  const [newBatsman, setNewBatsman] = useState("");
  const [newBatsmanSlot, setNewBatsmanSlot] = useState("");
  const [newBatsmanExcluded, setNewBatsmanExcluded] = useState("");
  const [bowlerOpen, setBowlerOpen] = useState(false);
  const [bowlerOrigin, setBowlerOrigin] = useState(null);
  const [commentaryOpen, setCommentaryOpen] = useState(false);
  const [commentaryOrigin, setCommentaryOrigin] = useState(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [scorecardOrigin, setScorecardOrigin] = useState(null);

  useEffect(() => useLiveMatchState(matchId, setState), [matchId]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 1500); return () => window.clearTimeout(t); }, [toast]);

  const innings = Array.isArray(state?.innings)
    ? state.innings.map((inn) => ({ ...inn, deliveries: deliveryList(inn?.deliveries) }))
    : [];
  const currentInn = innings.at(-1);
  const score = currentInn ? computeInnings(currentInn.deliveries || []) : { runs: 0, wickets: 0, legal: 0, overs: 0, balls: 0, batters: {}, bowlers: {} };
  const firstScore = innings[0] ? computeInnings(innings[0].deliveries || []) : null;
  const target = innings.length > 1 && firstScore ? firstScore.runs + 1 : null;
  const battingTeam = currentInn?.battingTeam || (innings.length === 0 ? setup.batting : fixture.t2);
  const bowlingTeam = currentInn?.bowlingTeam || (battingTeam === fixture.t1 ? fixture.t2 : fixture.t1);
  const hasStartedInnings = innings.length > 0;
  const effectiveStatus = state.status === "live" && !hasStartedInnings ? "upcoming" : state.status;
  const activeBattingPlayers = teams[battingTeam]?.players || [];
  const activeBowlingPlayers = teams[bowlingTeam]?.players || [];
  const inningsCards = innings.map((inn, i) => ({ ...inn, score: computeInnings(inn.deliveries || []), index: i }));
  useEffect(() => {
    if (state.status !== "innings2" || !innings[0]) return;
    const nextBatting = innings[0].bowlingTeam;
    const nextBowling = innings[0].battingTeam;
    setSecondSetup((current) => ({
      striker: current.striker || teams[nextBatting]?.players?.[0] || "",
      nonStriker: current.nonStriker || teams[nextBatting]?.players?.[1] || "",
      bowler: current.bowler || teams[nextBowling]?.players?.[0] || "",
      ballType: current.ballType || "pace"
    }));
  }, [state.status, innings, teams]);
  const dismissedPlayers = useMemo(() => unique((currentInn?.deliveries || []).filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed)), [currentInn]);
  const remainingPlayers = useMemo(() => activeBattingPlayers.filter((p) => !dismissedPlayers.includes(p)), [activeBattingPlayers, dismissedPlayers]);
  const soloBatter = state.status === "live" && score.wickets >= MAX_WICKETS - 1 && remainingPlayers.length <= 1;
  const previousBowler = state.live.previousBowler || "";

  const pushResult = (result, message) => {
    setHistory((h) => [...h, result.previous].slice(-40));
    setState(result.next);
    if (message) setToast(message);
    return result.next;
  };

  const startFirstInnings = async () => {
    if (!setup.tossWinner || !setup.tossDecision || !setup.striker || !setup.nonStriker || !setup.bowler) {
      setToast("Complete the toss and opening-player setup first");
      return;
    }

    const batting = setup.batting;
    const bowling = batting === fixture.t1 ? fixture.t2 : fixture.t1;
    const tossWinner = setup.tossWinner;
    const tossDecision = setup.tossDecision;

    try {
      const result = await commitMatchUpdate(matchId, {
        status: "live",
        toss: { winner: tossWinner, decision: tossDecision, batting, bowling },
        innings: [{ battingTeam: batting, bowlingTeam: bowling, deliveries: [] }],
        live: {
          striker: setup.striker,
          nonStriker: setup.nonStriker,
          bowler: setup.bowler,
          previousBowler: "",
          freeHit: false,
          ballType: setup.ballType
        },
        result: null
      }, { requireLiveStart: true });

      pushResult(result, "Match started — first innings is live");
    } catch (error) {
      console.error(error);
      setToast("Could not start match. Firebase did not confirm the live state.");
    }
  };

  const startSecondInnings = () => {
    const first = state.innings[0];
    const nextBatting = first.bowlingTeam;
    const nextBowling = first.battingTeam;
    const striker = secondSetup.striker || teams[nextBatting]?.players?.[0] || "";
    const nonStriker = secondSetup.nonStriker || teams[nextBatting]?.players?.[1] || "";
    const bowler = secondSetup.bowler || teams[nextBowling]?.players?.[0] || "";
    pushResult(patchMatch(matchId, (current) => ({
      ...current,
      status: "live",
      innings: [...current.innings, { battingTeam: nextBatting, bowlingTeam: nextBowling, deliveries: [] }],
      live: {
        striker,
        nonStriker,
        bowler,
        previousBowler: "",
        freeHit: false,
        ballType: secondSetup.ballType || "pace"
      }
    })), "Second innings started");
  };

  const addDelivery = (runs, opts = {}) => {
    if (!currentInn || state.status !== "live") return;
    const { wide = false, noBall = false, wicket = false, retired = false, wicketData = {} } = opts;
    const isRetireEvent = retired || ["Retired Hurt", "Retired Out"].includes(wicketData.type);
    if (!state.live.striker || !state.live.bowler) return setToast("Choose a striker and bowler");
    if (!soloBatter && !state.live.nonStriker) return setToast("Choose the non-striker");
    if (wicket && state.live.freeHit && wicketData.type !== "Run Out") return setToast("Only a run-out can be recorded on a free hit");

    const legal = !wide && !noBall && !isRetireEvent;
    const delivery = { striker: state.live.striker, nonStriker: state.live.nonStriker, bowler: isRetireEvent ? "" : state.live.bowler, runs: isRetireEvent ? 0 : runs, wide, noBall, deadBall: isRetireEvent, wicket: wicket && !isRetireEvent, retired: isRetireEvent, wicketType: wicket && !isRetireEvent ? wicketData.type : "", retirementType: isRetireEvent ? wicketData.type : "", dismissed: wicket || isRetireEvent ? wicketData.dismissed : "", fielder: wicketData.fielder || "", outEnd: wicketData.outEnd || "", dismissalText: wicket || isRetireEvent ? wicketData.text : "", ballType: state.live.ballType || "pace" };

    let nextIncomingSlot = "";
    let incomingCandidates = [];
    const result = patchMatch(matchId, (current) => {
      const inn = current.innings.at(-1);
      const deliveries = [...deliveryList(inn?.deliveries), delivery];
      const nextScore = computeInnings(deliveries);
      const players = teams[inn.battingTeam].players;
      const dismissed = unique(deliveries.filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
      const remaining = players.filter((p) => !dismissed.includes(p));
      const wasSolo = !current.live.nonStriker;
      const twoBattersBefore = Boolean(current.live.striker && current.live.nonStriker);
      let striker = current.live.striker;
      let nonStriker = current.live.nonStriker;
      let bowler = current.live.bowler;
      const overEnded = legal && nextScore.legal > 0 && nextScore.legal % 6 === 0;
      const isRunOut = wicket && wicketData.type === "Run Out";
      const isRetirement = isRetireEvent;

      if (!wasSolo && twoBattersBefore && !wicket && !isRetirement && !wide && !noBall && runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];

      if (isRunOut) {
        const dismissed = wicketData.dismissed;
        const survivor = dismissed === current.live.striker ? current.live.nonStriker : current.live.striker;
        const outEnd = wicketData.outEnd || (dismissed === current.live.striker ? "striker" : "nonStriker");
        if (remaining.length <= 1) {
          striker = remaining[0] || survivor;
          nonStriker = "";
          nextIncomingSlot = "solo";
        } else {
          striker = outEnd === "striker" ? "" : survivor;
          nonStriker = outEnd === "nonStriker" ? "" : survivor;
          nextIncomingSlot = outEnd;
        }
      } else if (isRetirement) {
        const dismissed = wicketData.dismissed;
        if (dismissed === current.live.striker) striker = ""; else if (dismissed === current.live.nonStriker) nonStriker = "";
        nextIncomingSlot = dismissed === current.live.striker ? "striker" : "nonStriker";
      } else if (wicket) {
        const dismissed = wicketData.dismissed;
        if (remaining.length <= 1 || nextScore.wickets >= MAX_WICKETS - 1) {
          striker = remaining[0] || "";
          nonStriker = "";
          nextIncomingSlot = "solo";
        } else {
          const slot = dismissed === current.live.striker ? "striker" : "nonStriker";
          if (slot === "striker") striker = ""; else nonStriker = "";
          nextIncomingSlot = slot;
        }
      }

      if (overEnded) {
        if (remaining.length <= 1 || nextScore.wickets >= MAX_WICKETS - 1) {
          striker = remaining[0] || striker;
          nonStriker = "";
        } else if (striker && nonStriker && !wicket && !isRetirement) {
          [striker, nonStriker] = [nonStriker, striker];
        }
        bowler = "";
      }

      const targetReached = current.innings.length === 2 && target != null && nextScore.runs >= target;
      const inningsDone = nextScore.wickets >= MAX_WICKETS || nextScore.legal >= MAX_OVERS * 6 || targetReached;
      const nextInnings = [...current.innings];
      nextInnings[nextInnings.length - 1] = { ...inn, deliveries };
      if (inningsDone && nextInnings.length === 1) return { ...current, status: "innings2", innings: nextInnings, live: emptyLive() };
      if (inningsDone && nextInnings.length === 2) {
        const completed = { ...current, status: "completed", innings: nextInnings, live: emptyLive() };
        return { ...completed, result: { ...describeResult(completed), t1: completed.innings[0].battingTeam, t2: completed.innings[1].battingTeam, t1Runs: computeInnings(completed.innings[0].deliveries).runs, t2Runs: computeInnings(completed.innings[1].deliveries).runs } };
      }
      if ((wicket || isRetirement) && nextIncomingSlot && nextIncomingSlot !== "solo") incomingCandidates = players.filter((p) => p !== wicketData.dismissed && p !== striker && p !== nonStriker && !dismissed.includes(p));
      return { ...current, innings: nextInnings, live: { ...current.live, striker, nonStriker, bowler, previousBowler: overEnded ? current.live.bowler : current.live.previousBowler, freeHit: isRetireEvent ? current.live.freeHit : (noBall ? true : (legal ? false : current.live.freeHit)) } };
    });

    pushResult(result, "");
    if (nextIncomingSlot === "solo" && result.next.status === "live") {
      setToast(`${result.next.live.striker || "Last batter"} is now the sole striker`);
      setWicketOpen(false);
      setNewBatsmanOpen(false);
    } else if ((wicket || isRetireEvent) && nextIncomingSlot && result.next.status === "live") {
      const liveDismissed = result.next.innings.at(-1)?.deliveries?.filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed) || [];
      const available = unique(incomingCandidates.length ? incomingCandidates : activeBattingPlayers.filter((p) => p !== wicketData.dismissed && !liveDismissed.includes(p)));
      setNewBatsman(available[0] || "");
      setNewBatsmanSlot(nextIncomingSlot);
      setNewBatsmanExcluded(wicketData.dismissed);
      setNewBatsmanOpen(true);
      setToast(isRetireEvent ? "Retirement recorded" : isRunOut ? "Run out recorded" : "Wicket recorded");
    } else if (wide) setToast("WIDE");
    else if (noBall) setToast("NO BALL");
    else if (runs === 6) setToast("SIX");
    else if (runs === 4) setToast("FOUR");
  };

  const openWicketModal = (event) => {
    const selected = state.live.striker || state.live.nonStriker;
    if (!selected) return setToast("No current batter to dismiss");
    if (!state.live.bowler) return setToast("Select a bowler before recording a wicket");
    setWicketDraft({ dismissed: selected, type: "Bowled", outEnd: "striker", fielder: "" });
    setWicketOrigin(originFromEvent(event));
    setWicketOpen(true);
  };

  const submitWicket = () => {
    const dismissed = wicketDraft.dismissed;
    if (!dismissed || ![state.live.striker, state.live.nonStriker].filter(Boolean).includes(dismissed)) return setToast("Choose a current batter");
    const retirement = ["Retired Hurt", "Retired Out"].includes(wicketDraft.type);
    const fielder = wicketDraft.fielder;
    const text = `${wicketDraft.type}${fielder ? `, ${fielder}` : ""}`;
    setWicketOpen(false);
    addDelivery(0, { wicket: !retirement, retired: retirement, wicketData: { type: wicketDraft.type, dismissed, fielder, outEnd: wicketDraft.type === "Run Out" ? wicketDraft.outEnd : dismissed === state.live.striker ? "striker" : "nonStriker", text } });
    setWicketDraft({ dismissed: "", type: "Bowled", outEnd: "striker", fielder: "" });
  };

  const getIncomingChoices = () => unique(activeBattingPlayers.filter((p) => p !== state.live.striker && p !== state.live.nonStriker && p !== newBatsmanExcluded && !dismissedPlayers.includes(p)));

  const skipNewBatsman = () => {
    setNewBatsmanOpen(false);
    setNewBatsman("");
    setNewBatsmanSlot("");
    setNewBatsmanExcluded("");
    setToast("No replacement selected");
  };

  const confirmNewBatsman = () => {
    const choices = getIncomingChoices();
    if (!choices.length) return skipNewBatsman();
    if (!newBatsman || !choices.includes(newBatsman)) return setToast("Choose the incoming batter");
    const slot = newBatsmanSlot;
    const chosen = newBatsman;
    const result = patchMatch(matchId, (current) => ({ ...current, live: { ...current.live, [slot]: chosen } }));
    setHistory((h) => [...h, result.previous].slice(-40));
    setState(result.next);
    setNewBatsmanOpen(false);
    setNewBatsman("");
    setNewBatsmanSlot("");
    setNewBatsmanExcluded("");
    setToast(`${chosen} comes in`);
  };

  const selectBowler = (name) => {
    if (!name || name === previousBowler) return setToast("That bowler just bowled the current over");
    const result = patchMatch(matchId, (current) => ({ ...current, live: { ...current.live, bowler: name } }));
    setHistory((h) => [...h, result.previous].slice(-40));
    setState(result.next);
    setBowlerOpen(false);
    setToast(`${name} starts the new over`);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return setToast("Nothing to undo");
    const result = patchMatch(matchId, previous);
    setState(clone(result.next));
    setHistory((h) => h.slice(0, -1));
    setWicketOpen(false); setNewBatsmanOpen(false); setBowlerOpen(false); setToast("Last action undone");
  };

  const reset = () => {
    if (!window.confirm(`Reset ${fixture.label}?`)) return;
    const result = patchMatch(matchId, () => ({ status: "upcoming", innings: [], live: emptyLive(), result: null, toss: null }));
    setState(result.next); setHistory([]); setWicketOpen(false); setNewBatsmanOpen(false); setBowlerOpen(false); setToast("Demo reset");
  };

  return <SiteFrame active="matches"><main className="section-wrap page-section scorer-page">
    <div className="scorer-topline"><a className="back-button" href={matchPath(matchId)}>← Viewer</a><div className="scorer-title"><span>{fixture.label} / OFFICIALS</span><ComicTitle>The <i>DRAFTS</i> / Scorer</ComicTitle></div><div className="scorer-actions"><button className="small-control blue-control undo-button" onClick={undo} disabled={!history.length}>Undo {history.length}</button><button className="small-control red-control undo-button reset-action" onClick={reset}>Reset</button></div></div>
    <div className="scoreboard-hero comic-panel dark-panel"><div className="scoreboard-team"><TeamBadge code={currentInn?.battingTeam || fixture.t1} large teams={teams} /><small>Batting</small></div><div className="score-main"><span className={`score-state state-${state.status}`}>{state.status}</span><strong>{score.runs}<em>/<WicketCount wickets={score.wickets} deliveries={currentInn?.deliveries || []} /></em></strong><span>{score.overs}.{score.balls} / {MAX_OVERS} overs {target ? `· target ${target}` : ""}</span></div><div className="scoreboard-team"><TeamBadge code={currentInn?.bowlingTeam || fixture.t2} large teams={teams} /><small>Bowling</small></div></div>

    {effectiveStatus === "upcoming" && <Setup fixture={fixture} teams={teams} setup={setup} setSetup={setSetup} onStart={startFirstInnings} />}
    {effectiveStatus === "innings2" && firstScore && <section className="innings-break comic-panel paper-panel"><div><span className="panel-kicker">INNINGS BREAK</span><ComicTitle as="h2">{fixture.t1 === innings[0]?.battingTeam ? fixture.t2 : fixture.t1} is chasing.</ComicTitle><p>First innings finished at {firstScore.runs}/{firstScore.wickets}. Set the opening players for the chase.</p></div><SecondInningsSetup battingTeam={innings[0].bowlingTeam} bowlingTeam={innings[0].battingTeam} teams={teams} setup={secondSetup} setSetup={setSecondSetup} onStart={startSecondInnings} isDraftMatch={fixture.internal} /></section>}

    {effectiveStatus === "live" && currentInn && <>
      <section className="comic-panel dark-panel active-panel"><div className="panel-heading"><div><span className="panel-kicker">LIVE CONTROL</span><ComicTitle as="h2">{currentInn.battingTeam} batting</ComicTitle></div><span className="live-chip"><i /> LIVE</span></div>
        <div className="player-strip"><div className="player-box active-player"><span>STRIKER</span><b>{state.live.striker || "Incoming batter"}</b>{soloBatter && <em>SOLE BATTER — ALWAYS ON STRIKE</em>}</div><div className="player-box"><span>NON-STRIKER</span><b>{state.live.nonStriker || (soloBatter ? "—" : "Incoming batter")}</b></div><div className="player-box bowler-box"><span>BOWLER</span><b>{state.live.bowler || "New over"}</b></div></div>
        {!state.live.bowler && <div className="new-over-control"><span>OVER COMPLETE / BOWLER CHANGE</span><button className="comic-button primary" onClick={(e) => { setBowlerOrigin(originFromEvent(e)); setBowlerOpen(true); }}>Select new bowler <span>→</span></button></div>}
        <div className="run-pad">{[0,1,2,3,4,5,6].map((r) => <button key={`run-${r}`} className="run-key run-family" disabled={!state.live.bowler} onClick={() => addDelivery(r)}>{r}</button>)}<button className="run-key wide-family" disabled={!state.live.bowler} onClick={() => addDelivery(0, { wide: true })}>WIDE</button><button className="run-key nb-family" disabled={!state.live.bowler} onClick={() => addDelivery(0, { noBall: true })}>NO BALL</button><button className="run-key wicket-key" disabled={!state.live.bowler} onClick={openWicketModal}>WICKET</button></div>
        <div className="scoring-tools"><button className="tool-button wicket-tool" disabled={!state.live.bowler} onClick={openWicketModal}>Record wicket / retirement</button><span>Free hit: <b>{state.live.freeHit ? "ON" : "OFF"}</b></span><span>{score.legal} legal balls</span></div>
      </section>
      <section className="scorer-lower"><article className="comic-panel paper-panel commentary-panel"><div className="panel-heading"><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary</ComicTitle></div><button className="expand-button viewer-family" onClick={(e) => morphOpen(e, "commentary-morph", () => { setCommentaryOrigin(originFromEvent(e)); setCommentaryOpen(true); })}>Expand ↗</button></div><Commentary deliveries={currentInn.deliveries} limit={6} /></article><article className="comic-panel paper-panel"><div className="panel-heading"><div><span className="panel-kicker">LIVE FIGURES</span><ComicTitle as="h2">Scorecard</ComicTitle></div><button className="expand-button scorecard-family" onClick={(e) => morphOpen(e, "scorecard-morph", () => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); })}>Open ↗</button></div><Scorecard innings={innings} /></article></section>
      <PlayerStats state={state} teamCodes={[fixture.t1, fixture.t2]} teams={teams} mode="scorer" />
    </>}

    {effectiveStatus === "completed" && <section className="result-panel comic-panel paper-panel"><span className="panel-kicker">MATCH COMPLETE</span><ComicTitle as="h2">{state.result?.winner === "tie" ? "Match tied" : `${state.result?.winner} wins`}</ComicTitle><p>{state.result?.desc}</p><div className="result-scores">{inningsCards.map((inn) => <div key={`result-${inn.index}`}><TeamBadge code={inn.battingTeam} teams={teams} /><strong>{inn.score.runs}/{inn.score.wickets}</strong><span>({inn.score.overs}.{inn.score.balls})</span></div>)}</div><button className="central-scorecard-button" onClick={(e) => morphOpen(e, "scorecard-morph", () => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); })}>VIEW SCORECARD ↗</button></section>}

    <div className="scorer-footer"><a className="comic-button secondary" href={matchPath(matchId)}>Public viewer ↗</a><button className="comic-button tertiary" onClick={(e) => morphOpen(e, "commentary-morph", () => { setCommentaryOrigin(originFromEvent(e)); setCommentaryOpen(true); })}>Open commentary ↗</button></div>

    {wicketOpen && <WicketModal origin={wicketOrigin} state={state} battingPlayers={activeBattingPlayers} bowlingPlayers={activeBowlingPlayers} draft={wicketDraft} setDraft={setWicketDraft} onClose={() => setWicketOpen(false)} onSubmit={submitWicket} />}
    {newBatsmanOpen && <NewBatsmanModal origin={newBatsmanOrigin} battingPlayers={activeBattingPlayers} live={state.live} dismissedPlayers={dismissedPlayers} excluded={newBatsmanExcluded} value={newBatsman} setValue={setNewBatsman} slot={newBatsmanSlot} onClose={() => { setNewBatsmanOpen(false); setNewBatsmanSlot(""); setNewBatsmanExcluded(""); }} onSubmit={confirmNewBatsman} onSkip={skipNewBatsman} />}
    {bowlerOpen && <BowlerModal origin={bowlerOrigin} bowlingPlayers={activeBowlingPlayers} currentInn={currentInn} previousBowler={previousBowler} onSelect={selectBowler} onClose={() => setBowlerOpen(false)} />}
    {commentaryOpen && <Modal origin={commentaryOrigin} onClose={() => setCommentaryOpen(false)} className="commentary-modal dark-panel" ariaLabel="Commentary archive" morphName="commentary-morph"><div className="panel-heading"><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary archive</ComicTitle></div><button className="expand-button close-button" onClick={() => setCommentaryOpen(false)}>Close ×</button></div><Commentary deliveries={currentInn?.deliveries || []} /></Modal>}
    {scorecardOpen && <ScorecardModal innings={innings} origin={scorecardOrigin} onClose={() => setScorecardOpen(false)} morphName="scorecard-morph" />}
    {toast && <div className="toast">{toast}</div>}
  </main></SiteFrame>;
}

function WicketModal({ origin, state, battingPlayers, bowlingPlayers, draft, setDraft, onClose, onSubmit }) {
  const isRunOut = draft.type === "Run Out";
  const showWho = isRunOut;
  const fielderNeeded = ["Caught", "Run Out", "Stumped"].includes(draft.type);
  return <Modal origin={origin} onClose={onClose} className="wicket-modal paper-panel" ariaLabel="Dismissal control"><div className="modal-heading"><div><span className="panel-kicker">DISMISSAL CONTROL</span><ComicTitle as="h2">Record the moment</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div><div className="modal-scroll-content">
    <div className={`dismissed-lock ${showWho ? "is-selectable" : ""}`}><span>DISMISSED BATTER</span>{showWho ? <div className="dismissal-player-choice">{[state.live.striker, state.live.nonStriker].filter(Boolean).map((p) => <button key={`dismissed-${p}`} className={`dismissed-option ${draft.dismissed === p ? "selected" : ""}`} onClick={() => setDraft((d) => ({ ...d, dismissed: p }))}>{p}<small>{p === state.live.striker ? "STRIKER" : "NON-STRIKER"}</small></button>)}</div> : <div className="dismissed-fixed"><b>{draft.dismissed || state.live.striker}</b><span>{draft.dismissed === state.live.nonStriker ? "NON-STRIKER" : "STRIKER"} is selected automatically.</span></div>}</div>
    <label>Event type<select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value, fielder: "", outEnd: d.outEnd }))}>{DISMISSAL_TYPES.map((t) => <option key={`dismissal-${t}`}>{t}</option>)}</select></label>
    {isRunOut && <div className="runout-controls"><span className="panel-kicker">RUN OUT / TWO DECISIONS</span><label>Where did the batter get out?<select value={draft.outEnd} onChange={(e) => setDraft((d) => ({ ...d, outEnd: e.target.value }))}><option value="striker">Striker's end</option><option value="nonStriker">Non-striker's end</option></select></label><p>Choose who was dismissed above and independently choose the end where the dismissal occurred. The incoming batter walks in at that end.</p></div>}
    {fielderNeeded && <label>Fielder<select value={draft.fielder} onChange={(e) => setDraft((d) => ({ ...d, fielder: e.target.value }))}><option value="">Select fielder</option>{unique(bowlingPlayers).map((p) => <option key={`fielder-${p}`}>{p}</option>)}</select></label>}
    {["Retired Hurt", "Retired Out"].includes(draft.type) && <div className="retirement-note">Retirement events are recorded without a legal ball, bowler run or bowler wicket.</div>}
  </div><div className="modal-actions"><button className="back-button viewer-family" onClick={onClose}>Cancel</button><button className="comic-button primary" onClick={onSubmit}>Confirm <span>→</span></button></div></Modal>;
}

function NewBatsmanModal({ origin, battingPlayers, live, dismissedPlayers, excluded, value, setValue, slot, onClose, onSubmit, onSkip }) {
  const choices = unique(battingPlayers.filter((p) => p !== live.striker && p !== live.nonStriker && p !== excluded && !dismissedPlayers.includes(p)));
  const noneLeft = choices.length === 0;
  return <Modal origin={origin} onClose={onClose} className="new-batsman-modal paper-panel" ariaLabel="Next batter">
    <div className="modal-heading"><div><span className="panel-kicker">NEXT BATTER</span><ComicTitle as="h2">Who walks in?</ComicTitle></div><button className="modal-close-button close-button offline-safe" onClick={onClose}>Close ×</button></div>
    {noneLeft ? <div className="no-incoming-player"><strong>No eligible batter remains.</strong><p>You can leave this batting slot vacant and continue the match control without selecting a replacement.</p></div> : <><p>The incoming batter enters at the selected end.</p><label>Incoming batter<select value={value} onChange={(e) => setValue(e.target.value)}>{choices.map((p) => <option key={`incoming-${p}`}>{p}</option>)}</select></label></>}
    <div className="incoming-slot">{slot === "striker" ? "STRIKER'S END" : "NON-STRIKER'S END"}</div>
    <div className="modal-actions"><button className="back-button viewer-family offline-safe" onClick={onClose}>Cancel</button>{noneLeft ? <button className="comic-button primary" onClick={onSkip}>Do not bring anyone in <span>→</span></button> : <button className="comic-button primary" onClick={onSubmit}>Bring in <span>→</span></button>}</div>
  </Modal>;
}

function BowlerModal({ origin, bowlingPlayers, currentInn, previousBowler, onSelect, onClose }) {
  const score = currentInn ? computeInnings(currentInn.deliveries) : { bowlers: {} };
  return <Modal origin={origin} onClose={onClose} className="bowler-modal paper-panel" ariaLabel="Select new bowler"><div className="modal-heading"><div><span className="panel-kicker">NEW OVER</span><ComicTitle as="h2">Select new bowler</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div><p>The bowler from the previous over is locked. Choose another eligible bowler.</p><div className="bowler-choice-grid">{unique(bowlingPlayers).map((p, index) => { const f = score.bowlers[p] || { balls: 0, runs: 0, wickets: 0 }; const locked = p === previousBowler; const econ = f.balls ? (f.runs / (f.balls / 6)).toFixed(2) : "—"; return <button type="button" className={`player-pick ${locked ? "locked" : ""} player-pick-${index % 3}`} key={`bowler-${p}`} disabled={locked} onClick={() => onSelect(p)}><div className="bowler-name"><b>{p}</b>{locked && <span className="lock-mark">LOCKED</span>}</div><div className="bowler-metrics"><span><b>{Math.floor(f.balls / 6)}.{f.balls % 6}</b><small>OVERS</small></span><span><b>{econ}</b><small>ECON</small></span><span><b>{f.wickets}</b><small>WICKETS</small></span></div><span className="pick-label">{locked ? "JUST BOWLED THIS OVER" : "SELECT BOWLER →"}</span></button>; })}</div></Modal>;
}

function SecondInningsSetup({ battingTeam, bowlingTeam, teams, setup, setSetup, onStart, isDraftMatch = false }) {
  const battingPlayers = unique(teams[battingTeam]?.players || []);
  const bowlingPlayers = unique(teams[bowlingTeam]?.players || []);
  return <div className="second-innings-setup">
    <div className="setup-grid">
      <label>Striker<select value={setup.striker} onChange={(e) => setSetup((s) => ({ ...s, striker: e.target.value }))}>{battingPlayers.map((p) => <option key={`second-striker-${p}`}>{p}</option>)}</select></label>
      <label>Non-striker<select value={setup.nonStriker} onChange={(e) => setSetup((s) => ({ ...s, nonStriker: e.target.value }))}>{battingPlayers.filter((p) => p !== setup.striker).map((p) => <option key={`second-non-${p}`}>{p}</option>)}</select></label>
      <label>Bowler<select value={setup.bowler} onChange={(e) => setSetup((s) => ({ ...s, bowler: e.target.value }))}>{bowlingPlayers.map((p) => <option key={`second-bowler-${p}`}>{p}</option>)}</select></label>
    </div>
    {!isDraftMatch && <div className="setup-ball-type"><span className="panel-kicker">OPENING BOWLING TYPE</span><div className="setup-choice-row"><button type="button" className={`choice-chip ${setup.ballType === "pace" ? "selected" : ""}`} onClick={() => setSetup((s) => ({ ...s, ballType: "pace" }))}>Pace</button><button type="button" className={`choice-chip ${setup.ballType === "spin" ? "selected" : ""}`} onClick={() => setSetup((s) => ({ ...s, ballType: "spin" }))}>Spin</button></div></div>}
    <button className="comic-button primary wide-button" onClick={onStart}>Start second innings <span>→</span></button>
  </div>;
}

function Setup({ fixture, teams, setup, setSetup, onStart }) {
  const bowling = setup.batting === fixture.t1 ? fixture.t2 : fixture.t1;
  const tossTeams = [fixture.t1, fixture.t2];
  const battingPlayers = unique(teams[setup.batting]?.players || []);
  const bowlingPlayers = unique(teams[bowling]?.players || []);
  const updateToss = (winner, decision) => {
    const batting = decision === "bat" ? winner : (winner === fixture.t1 ? fixture.t2 : fixture.t1);
    const bowl = batting === fixture.t1 ? fixture.t2 : fixture.t1;
    setSetup({
      ...setup,
      tossWinner: winner,
      tossDecision: decision,
      batting,
      striker: teams[batting]?.players?.[0] || "",
      nonStriker: teams[batting]?.players?.[1] || "",
      bowler: teams[bowl]?.players?.[0] || ""
    });
  };
  return <section className="comic-panel paper-panel setup-panel">
    <div className="panel-heading"><div><span className="panel-kicker">MATCH SETUP</span><ComicTitle as="h2">Set the opening players</ComicTitle></div><span className="format-stamp">3 WICKETS / 6 OVERS</span></div>
    <div className="setup-grid">
      <div className="setup-derived"><span>Batting first</span><strong>{setup.batting}</strong></div>
      <div className="setup-derived"><span>Bowling first</span><strong>{bowling}</strong></div>
      <label>Toss winner<select value={setup.tossWinner} onChange={(e) => updateToss(e.target.value, setup.tossDecision)}>{tossTeams.map((t) => <option key={`toss-winner-${t}`}>{t}</option>)}</select></label>
      <label>Toss decision<select value={setup.tossDecision} onChange={(e) => updateToss(setup.tossWinner, e.target.value)}><option value="bat">Bat first</option><option value="bowl">Bowl first</option></select></label>
      <label>Striker<select value={setup.striker} onChange={(e) => setSetup((s) => ({ ...s, striker: e.target.value }))}>{battingPlayers.map((p) => <option key={`setup-striker-${p}`}>{p}</option>)}</select></label>
      <label>Non-striker<select value={setup.nonStriker} onChange={(e) => setSetup((s) => ({ ...s, nonStriker: e.target.value }))}>{battingPlayers.filter((p) => p !== setup.striker).map((p) => <option key={`setup-non-${p}`}>{p}</option>)}</select></label>
      <label>Bowler<select value={setup.bowler} onChange={(e) => setSetup((s) => ({ ...s, bowler: e.target.value }))}>{bowlingPlayers.map((p) => <option key={`setup-bowler-${p}`}>{p}</option>)}</select></label>
    </div>
    {!fixture.internal && <div className="setup-ball-type"><span className="panel-kicker">OPENING BOWLING TYPE</span><div className="setup-choice-row"><button type="button" className={`choice-chip ${setup.ballType === "pace" ? "selected" : ""}`} onClick={() => setSetup((s) => ({ ...s, ballType: "pace" }))}>Pace</button><button type="button" className={`choice-chip ${setup.ballType === "spin" ? "selected" : ""}`} onClick={() => setSetup((s) => ({ ...s, ballType: "spin" }))}>Spin</button></div></div>}
    <button className="comic-button primary wide-button" onClick={onStart}>Start Match <span>→</span></button>
  </section>;
}

function NotFoundScorer() {
  return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">404 / SCORER NOT FOUND</span><ComicTitle as="h2">That fixture does not exist.</ComicTitle><p>Use the match archive to open a valid scorer page.</p><a className="comic-button primary" href={sitePath("/matches")}>Back to matches ↗</a></section></main></SiteFrame>;
}
