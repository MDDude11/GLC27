import { useEffect, useMemo, useRef, useState } from "react";
import {
  MATCHES,
  MAX_OVERS,
  MAX_WICKETS,
  SUPER_OVER_MAX_OVERS,
  SUPER_OVER_MAX_WICKETS,
  SCORER_PASSWORD,
  SCORER_SESSION_KEY,
  TEAMS,
  emptyLive,
  emptyStage,
  matchPath,
  scorerPath,
  sitePath
} from "./data.js";
import { clone, computeInnings, describeResult, repairLiveForTeams } from "./engine.js";
import { getMatch, patchMatch, commitMatchUpdate, useLiveMatchState, resolveMatchFixture } from "./store.js";
import {
  SiteFrame,
  ComicTitle,
  TeamBadge,
  Commentary,
  Scorecard,
  PlayerStats,
  ScorecardModal,
  Modal,
  WicketCount
} from "./components.jsx";

const deliveryList = (value = []) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value).filter(([, delivery]) => delivery != null);
  if (entries.length > 1 && entries.every(([key]) => /^\d+$/.test(key))) {
    entries.sort(([a], [b]) => Number(a) - Number(b));
  }
  return entries.map(([, delivery]) => delivery);
};

const unique = (items) => [...new Set((items || []).filter(Boolean))];
const currentOverDeliveries = (deliveries = []) => {
  const list = deliveryList(deliveries);
  let legalCount = 0;
  let current = [];
  let lastComplete = [];
  for (const delivery of list) {
    current.push(delivery);
    if (!delivery.wide && !delivery.noBall && !delivery.retired && !delivery.deadBall) {
      legalCount += 1;
      if (legalCount % 6 === 0) {
        lastComplete = current;
        current = [];
      }
    }
  }
  return current.length ? current : lastComplete;
};

const deliveryResultLabel = (delivery) => {
  if (!delivery) return "";
  if (delivery.retired) return "RET";
  if (delivery.wicket) return "W";
  if (delivery.wide) return delivery.runs ? `WD+${delivery.runs}` : "WD";
  if (delivery.noBall) return delivery.runs ? `NB+${delivery.runs}` : "NB";
  return String(Number(delivery.runs) || 0);
};

const deliveryResultClass = (delivery) => {
  if (delivery?.retired) return "is-retired";
  if (delivery?.wicket) return "is-wicket";
  if (delivery?.wide || delivery?.noBall) return "is-extra";
  return [4, 6].includes(Number(delivery?.runs) || 0) ? "is-boundary" : "";
};

const DISMISSAL_TYPES = ["Bowled", "Caught", "LBW", "Run Out", "Hit Wicket", "Stumped"];

function validOpeningSetup(setup, battingTeam, bowlingTeam, teams) {
  const batters = unique(teams[battingTeam]?.players || []);
  const bowlers = unique(teams[bowlingTeam]?.players || []);
  return Boolean(
    setup?.striker &&
    setup?.nonStriker &&
    setup.striker !== setup.nonStriker &&
    batters.includes(setup.striker) &&
    batters.includes(setup.nonStriker) &&
    bowlers.includes(setup.bowler)
  );
}

function originFromEvent(event) {
  const r = event?.currentTarget?.getBoundingClientRect?.();
  if (!r) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function normaliseStage(raw, index, teams = TEAMS) {
  const fallback = emptyStage(index);
  return repairLiveForTeams({
    ...fallback,
    ...(raw || {}),
    index,
    stage: "superOver",
    innings: Array.isArray(raw?.innings)
      ? raw.innings.map((inn) => ({ ...inn, deliveries: deliveryList(inn?.deliveries), maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS }))
      : [],
    live: { ...fallback.live, ...(raw?.live || {}) },
    maxOvers: SUPER_OVER_MAX_OVERS,
    maxWickets: SUPER_OVER_MAX_WICKETS
  }, teams);
}

function stageResult(stage) {
  return stage?.innings?.length >= 2 ? describeResult(stage, { maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS }) : null;
}

export default function ScorerPage({ matchId, superOverIndex = 0 }) {
  const [fixture, setFixture] = useState(() => MATCHES[matchId] || null);
  const [loading, setLoading] = useState(!MATCHES[matchId]);
  const sessionKey = `${SCORER_SESSION_KEY}_${matchId}`;
  const [unlocked, setUnlocked] = useState(() => typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessionKey) === "1");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    if (MATCHES[matchId]) return undefined;
    void resolveMatchFixture(matchId).then((resolved) => {
      if (active) {
        setFixture(resolved);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [matchId]);

  if (loading) return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">INTERNAL MATCH</span><ComicTitle as="h2">Loading match…</ComicTitle><p>Fetching the match record from Firebase.</p></section></main></SiteFrame>;
  if (!fixture) return <NotFoundScorer />;
  if (!unlocked) return <PasswordGate password={password} setPassword={setPassword} onUnlock={() => setUnlocked(true)} fixture={fixture} sessionKey={sessionKey} />;
  return <ScorerDesk key={`${matchId}-${superOverIndex}`} matchId={matchId} fixture={fixture} superOverIndex={Number(superOverIndex) || 0} />;
}

function PasswordGate({ password, setPassword, onUnlock, fixture, sessionKey }) {
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (password === SCORER_PASSWORD) {
      sessionStorage.setItem(sessionKey, "1");
      onUnlock();
    } else {
      setError("Incorrect scorer password.");
    }
  };
  return <SiteFrame active="matches"><main className="section-wrap page-section password-page"><section className="password-card comic-panel paper-panel"><span className="panel-kicker">OFFICIALS ONLY / {fixture.label}</span><ComicTitle>Scorer <i>access</i></ComicTitle><p>This page controls the live match.</p><form onSubmit={submit}><label>Scorer password<input autoFocus type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Enter password" /></label>{error && <div className="form-error">{error}</div>}<button className="comic-button primary wide-button" type="submit">Unlock scorer <span>→</span></button></form><a className="back-link" href={matchPath(fixture.id)}>← Return to public viewer</a></section></main></SiteFrame>;
}

function ScorerDesk({ matchId, fixture, superOverIndex }) {
  const teams = fixture.teams || TEAMS;
  const isSuper = superOverIndex > 0;
  const [state, setState] = useState(() => getMatch(matchId));
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState("");
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketOrigin, setWicketOrigin] = useState(null);
  const [wicketDraft, setWicketDraft] = useState({ type: "Bowled", dismissed: "", outEnd: "striker", fielder: "" });
  const [retirementOpen, setRetirementOpen] = useState(false);
  const [retirementOrigin, setRetirementOrigin] = useState(null);
  const [retirementType, setRetirementType] = useState("Retired Hurt");
  const [retirementPlayer, setRetirementPlayer] = useState("");
  const [newBatsmanOpen, setNewBatsmanOpen] = useState(false);
  const [newBatsman, setNewBatsman] = useState("");
  const [newBatsmanSlot, setNewBatsmanSlot] = useState("");
  const [newBatsmanExcluded, setNewBatsmanExcluded] = useState("");
  const [newBatsmanChoices, setNewBatsmanChoices] = useState([]);
  const [bowlerOpen, setBowlerOpen] = useState(false);
  const [bowlerOrigin, setBowlerOrigin] = useState(null);
  const [commentaryOpen, setCommentaryOpen] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [scorecardOrigin, setScorecardOrigin] = useState(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnPlayer, setReturnPlayer] = useState("");
  const [manualAdjustOpen, setManualAdjustOpen] = useState(false);
  const [manualAdjustTeam, setManualAdjustTeam] = useState(fixture.t1);
  const [manualAdjustAmount, setManualAdjustAmount] = useState(1);
  const [mandatoryUndoType, setMandatoryUndoType] = useState("");
  const [redoSnapshot, setRedoSnapshot] = useState(null);
  const [redoSeconds, setRedoSeconds] = useState(0);
  const [expandedExtra, setExpandedExtra] = useState("");
  const preparingSuperRef = useRef(false);

  const rootSuperOvers = Array.isArray(state?.superOvers) ? state.superOvers.map((stage, index) => normaliseStage(stage, index + 1, teams)) : [];
  const baseCurrentStage = isSuper ? (rootSuperOvers[superOverIndex - 1] || emptyStage(superOverIndex)) : {
    index: 0,
    stage: "main",
    status: state?.status || "upcoming",
    innings: Array.isArray(state?.innings) ? state.innings : [],
    live: state?.live || emptyLive(),
    result: state?.result || null,
    maxOvers: MAX_OVERS,
    maxWickets: MAX_WICKETS
  };

  const currentStage = (() => {
    const stageStatus = isSuper ? baseCurrentStage.status : state?.status;
    const stageInn = Array.isArray(baseCurrentStage?.innings) ? baseCurrentStage.innings.at(-1) : null;
    if (stageStatus !== "live" || !stageInn) return baseCurrentStage;
    const stagePlayers = unique(teams[stageInn.battingTeam]?.players || []);
    const stageDismissed = unique(deliveryList(stageInn.deliveries).filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
    const stageRemaining = stagePlayers.filter((player) => !stageDismissed.includes(player));
    if (stageRemaining.length !== 1) return baseCurrentStage;
    const live = baseCurrentStage.live || emptyLive();
    if (live.striker === stageRemaining[0] && !live.nonStriker) return baseCurrentStage;
    if (live.nonStriker === stageRemaining[0] && live.striker) return { ...baseCurrentStage, live: { ...live, striker: stageRemaining[0], nonStriker: "" } };
    return { ...baseCurrentStage, live: { ...live, striker: stageRemaining[0], nonStriker: "" } };
  })();

  const stageInnings = Array.isArray(currentStage?.innings)
    ? currentStage.innings.map((inn) => ({ ...inn, deliveries: deliveryList(inn?.deliveries), maxOvers: isSuper ? SUPER_OVER_MAX_OVERS : MAX_OVERS, maxWickets: isSuper ? SUPER_OVER_MAX_WICKETS : MAX_WICKETS }))
    : [];
  const currentInn = stageInnings.at(-1);
  const maxOvers = isSuper ? SUPER_OVER_MAX_OVERS : MAX_OVERS;
  const maxWickets = isSuper ? SUPER_OVER_MAX_WICKETS : MAX_WICKETS;
  const stageManualAdjustments = isSuper ? (currentStage.manualAdjustments || {}) : (state.manualAdjustments?.main || {});
  const score = currentInn ? computeInnings(currentInn.deliveries, { maxOvers, maxWickets, manualAdjustment: Number(stageManualAdjustments[currentInn.battingTeam]) || 0 }) : { runs: 0, wickets: 0, legal: 0, overs: 0, balls: 0, batters: {}, bowlers: {} };
  const firstScore = stageInnings[0] ? computeInnings(stageInnings[0].deliveries, { maxOvers, maxWickets, manualAdjustment: Number(stageManualAdjustments[stageInnings[0].battingTeam]) || 0 }) : null;
  const target = stageInnings.length > 1 && firstScore ? firstScore.runs + 1 : null;
  const battingTeam = currentInn?.battingTeam || (stageInnings.length ? stageInnings[0].battingTeam : (isSuper ? "" : fixture.t1));
  const bowlingTeam = currentInn?.bowlingTeam || (battingTeam === fixture.t1 ? fixture.t2 : fixture.t1);
  const activeBattingPlayers = teams[battingTeam]?.players || [];
  const activeBowlingPlayers = teams[bowlingTeam]?.players || [];
  const hasStartedStage = stageInnings.length > 0;
  const mainStatus = isSuper ? currentStage.status : state.status;
  const isLive = mainStatus === "live";

  const dismissedPlayers = useMemo(() => unique((currentInn?.deliveries || []).filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed)), [currentInn]);
  const remainingPlayers = useMemo(() => activeBattingPlayers.filter((p) => !dismissedPlayers.includes(p)), [activeBattingPlayers, dismissedPlayers]);
  const soloBatter = isLive && remainingPlayers.length <= 1;
  const retiredHurt = unique(currentStage?.live?.retiredHurt || (isSuper ? [] : state?.live?.retiredHurt || []));
  const canReturnHurt = retiredHurt.length > 0 && score.wickets >= 2;

  const inspectMandatoryState = (snapshot) => {
    const stage = isSuper
      ? normaliseStage(snapshot?.superOvers?.[superOverIndex - 1], superOverIndex, teams)
      : {
          status: snapshot?.status || "upcoming",
          innings: Array.isArray(snapshot?.innings) ? snapshot.innings : [],
          live: snapshot?.live || emptyLive(),
          result: snapshot?.result || null
        };
    const innings = Array.isArray(stage.innings) ? stage.innings : [];
    const inn = innings.at(-1);
    if (!inn || stage.status !== "live") return null;
    const deliveries = deliveryList(inn.deliveries);
    const inningsScore = computeInnings(deliveries, { maxOvers, maxWickets });
    const hurt = unique(stage.live?.retiredHurt || []);
    if (hurt.length && inningsScore.wickets >= 2) return { type: "return", player: hurt[0] };

    const latest = deliveries.at(-1);
    const live = stage.live || emptyLive();
    const incomingSlot = !live.striker ? "striker" : (!live.nonStriker ? "nonStriker" : "");
    const activePlayers = unique(teams[inn.battingTeam]?.players || []);
    const dismissed = unique(deliveries.filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
    const remaining = activePlayers.filter((player) => !dismissed.includes(player));
    const choices = unique(activePlayers.filter((player) => player !== live.striker && player !== live.nonStriker && !dismissed.includes(player)));
    if (latest?.dismissed && (latest.wicket || latest.retired) && incomingSlot && remaining.length > 1 && choices.length) {
      return { type: "newBatsman", slot: incomingSlot, excluded: latest.dismissed, choices };
    }
    return null;
  };

  useEffect(() => useLiveMatchState(matchId, setState), [matchId]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!canReturnHurt || returnOpen || !isLive) return;
    setReturnPlayer(retiredHurt[0] || "");
    setReturnOpen(true);
  }, [canReturnHurt, returnOpen, isLive, retiredHurt]);

  useEffect(() => {
    if (!redoSnapshot) return undefined;
    const endAt = Date.now() + 10000;
    setRedoSeconds(10);
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRedoSeconds(seconds);
      if (seconds <= 0) {
        setRedoSnapshot(null);
        setRedoSeconds(0);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [redoSnapshot]);

  const clearRedo = () => {
    setRedoSnapshot(null);
    setRedoSeconds(0);
  };

  const stageDataForWrite = (nextStage) => ({
    ...nextStage,
    innings: (nextStage.innings || []).map((inn) => ({ ...inn, deliveries: deliveryList(inn?.deliveries) }))
  });

  const pushResult = (result, message = "") => {
    if (!result) return null;
    setHistory((old) => [...old, result.previous].slice(-40));
    setRedoSnapshot(null);
    setRedoSeconds(0);
    setMandatoryUndoType("");
    setState(result.next);
    if (message) setToast(message);
    return result.next;
  };

  const ensureSuperStage = async () => {
    if (!isSuper || preparingSuperRef.current) return rootSuperOvers[superOverIndex - 1] || currentStage;
    const existing = rootSuperOvers[superOverIndex - 1];
    if (existing?.battingFirst && existing?.bowlingFirst) return existing;
    preparingSuperRef.current = true;
    const prior = superOverIndex === 1 ? {
      innings: state.innings || [],
      result: state.result || null
    } : normaliseStage(rootSuperOvers[superOverIndex - 2], superOverIndex - 1, teams);
    const priorResult = prior.result || stageResult(prior);
    if (priorResult?.winner !== "tie") {
      preparingSuperRef.current = false;
      setToast("A Super Over can only begin after the previous stage is tied");
      return null;
    }
    const previousSecond = prior.innings?.[1]?.battingTeam || "";
    const previousFirst = prior.innings?.[0]?.battingTeam || "";
    if (!previousSecond || !previousFirst) {
      preparingSuperRef.current = false;
      setToast("The previous tied stage must be complete before starting a Super Over");
      return null;
    }
    const stage = { ...(existing || emptyStage(superOverIndex)), battingFirst: existing?.battingFirst || previousSecond, bowlingFirst: existing?.bowlingFirst || previousFirst };
    try {
      const result = await commitMatchUpdate(matchId, (current) => ({
        ...current,
        superOvers: replaceStage(current.superOvers, superOverIndex - 1, stage)
      }), { requireLiveStart: false });
      pushResult(result, `Super Over ${superOverIndex} is ready`);
      return stage;
    } finally {
      preparingSuperRef.current = false;
    }
  };

  useEffect(() => {
    const configuredStage = rootSuperOvers[superOverIndex - 1];
    const priorIsTied = superOverIndex === 1 ? state.result?.winner === "tie" : stageResult(rootSuperOvers[superOverIndex - 2])?.winner === "tie";
    if (isSuper && (!configuredStage?.battingFirst || !configuredStage?.bowlingFirst) && priorIsTied) {
      void ensureSuperStage();
    }
  }, [isSuper, superOverIndex, rootSuperOvers.length, rootSuperOvers[superOverIndex - 1]?.battingFirst, rootSuperOvers[superOverIndex - 1]?.bowlingFirst, state.result?.winner, rootSuperOvers[superOverIndex - 2]?.result?.winner]);

  const saveStage = (stage) => {
    if (!isSuper) {
      const result = patchMatch(matchId, (current) => ({ ...current, ...stage, innings: stage.innings, live: stage.live, result: stage.result, status: stage.status }));
      return pushResult(result);
    }
    const result = patchMatch(matchId, (current) => {
      const overs = [...(current.superOvers || [])];
      const next = stageDataForWrite(stage);
      overs[superOverIndex - 1] = next;
      return { ...current, superOvers: overs };
    });
    return pushResult(result);
  };

  const startMainFirstInnings = async (setup) => {
    const batting = setup.batting;
    const bowling = batting === fixture.t1 ? fixture.t2 : fixture.t1;
    if (!validOpeningSetup(setup, batting, bowling, teams)) {
      setToast("Choose two different batters and a bowler from the correct teams");
      return;
    }
    try {
      const result = await commitMatchUpdate(matchId, {
        status: "live",
        toss: { winner: setup.tossWinner, decision: setup.tossDecision, batting, bowling },
        innings: [{ battingTeam: batting, bowlingTeam: bowling, deliveries: [], maxOvers: MAX_OVERS, maxWickets: MAX_WICKETS }],
        live: { ...emptyLive(), striker: setup.striker, nonStriker: setup.nonStriker, bowler: setup.bowler },
        result: null,
        finalResult: null,
        superOvers: []
      }, { requireLiveStart: true });
      pushResult(result, "Match started — first innings is live");
    } catch (error) {
      console.error(error);
      setToast("Could not start match. Firebase did not confirm the live state.");
    }
  };

  const startSecondInnings = (setup) => {
    const first = state.innings?.[0];
    if (!first) return;
    const nextBatting = first.bowlingTeam;
    const nextBowling = first.battingTeam;
    if (!validOpeningSetup(setup, nextBatting, nextBowling, teams)) {
      setToast("Choose two different batters and a bowler from the correct teams");
      return;
    }
    const result = patchMatch(matchId, (current) => ({
      ...current,
      status: "live",
      innings: [...current.innings, { battingTeam: nextBatting, bowlingTeam: nextBowling, deliveries: [], maxOvers: MAX_OVERS, maxWickets: MAX_WICKETS }],
      live: { ...emptyLive(), striker: setup.striker, nonStriker: setup.nonStriker, bowler: setup.bowler }
    }));
    pushResult(result, "Second innings started");
  };

  const startSuperFirstInnings = (setup) => {
    const stage = rootSuperOvers[superOverIndex - 1] || emptyStage(superOverIndex);
    const prior = superOverIndex === 1 ? { innings: state.innings || [], result: state.result || null } : normaliseStage(rootSuperOvers[superOverIndex - 2], superOverIndex - 1, teams);
    const priorResult = prior.result || stageResult(prior);
    if (priorResult?.winner !== "tie") {
      setToast("This Super Over is only available after a tied stage");
      return;
    }
    const batting = stage.battingFirst;
    const bowling = stage.bowlingFirst;
    if (!batting || !bowling) {
      setToast("Could not establish Super Over teams from the tied stage");
      return;
    }
    if (!validOpeningSetup(setup, batting, bowling, teams)) {
      setToast("Choose two different batters and a bowler from the correct teams");
      return;
    }
    const nextStage = { ...stage, status: "live", innings: [{ battingTeam: batting, bowlingTeam: bowling, deliveries: [], maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS }], live: { ...emptyLive(), striker: setup.striker, nonStriker: setup.nonStriker, bowler: setup.bowler }, result: null };
    saveStage(nextStage);
    setToast(`Super Over ${superOverIndex} is live`);
  };

  const startSuperSecondInnings = (setup) => {
    const stage = rootSuperOvers[superOverIndex - 1];
    if (!stage?.innings?.[0]) return;
    const first = stage.innings[0];
    if (!validOpeningSetup(setup, first.bowlingTeam, first.battingTeam, teams)) {
      setToast("Choose two different batters and a bowler from the correct teams");
      return;
    }
    const nextStage = {
      ...stage,
      status: "live",
      innings: [...stage.innings, { battingTeam: first.bowlingTeam, bowlingTeam: first.battingTeam, deliveries: [], maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS }],
      live: { ...emptyLive(), striker: setup.striker, nonStriker: setup.nonStriker, bowler: setup.bowler }
    };
    saveStage(nextStage);
    setToast(`Super Over ${superOverIndex} second innings is live`);
  };

  const addDelivery = (runs, opts = {}) => {
    if (!currentInn || !isLive) return;
    const { wide = false, noBall = false, wicket = false, retired = false, wicketData = {} } = opts;
    const isRetireEvent = Boolean(retired);
    if (!currentStage.live.striker || !currentStage.live.bowler) return setToast("Choose a striker and bowler");
    if (!soloBatter && !currentStage.live.nonStriker) return setToast("Choose the non-striker");
    if (wicket && currentStage.live.freeHit && wicketData.type !== "Run Out") return setToast("Only a run-out can be recorded on a free hit");

    const legal = !wide && !noBall && !isRetireEvent;
    const delivery = {
      striker: currentStage.live.striker,
      nonStriker: currentStage.live.nonStriker,
      bowler: isRetireEvent ? "" : currentStage.live.bowler,
      runs: isRetireEvent ? 0 : runs,
      wide,
      noBall,
      deadBall: isRetireEvent,
      wicket: wicket && !isRetireEvent,
      retired: isRetireEvent,
      wicketType: wicket && !isRetireEvent ? wicketData.type : "",
      retirementType: isRetireEvent ? wicketData.type : "",
      dismissed: wicket || isRetireEvent ? wicketData.dismissed : "",
      fielder: wicketData.fielder || "",
      outEnd: wicketData.outEnd || "",
      dismissalText: wicket || isRetireEvent ? wicketData.text : "",
      ballType: currentStage.live.ballType || "pace"
    };

    let incomingSlot = "";
    const result = patchMatch(matchId, (current) => {
      const stage = isSuper ? normaliseStage(current.superOvers?.[superOverIndex - 1], superOverIndex, teams) : {
        status: current.status,
        innings: Array.isArray(current.innings) ? current.innings : [],
        live: current.live || emptyLive(),
        result: current.result
      };
      const inn = stage.innings.at(-1);
      const deliveries = [...deliveryList(inn?.deliveries), delivery];
      const nextScore = computeInnings(deliveries, { maxOvers, maxWickets });
      const players = teams[inn.battingTeam]?.players || [];
      const dismissed = unique(deliveries.filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
      const remaining = players.filter((p) => !dismissed.includes(p));
      let striker = stage.live.striker;
      let nonStriker = stage.live.nonStriker;
      let bowler = stage.live.bowler;
      const overEnded = legal && nextScore.legal > 0 && nextScore.legal % 6 === 0;
      const isRunOut = wicket && wicketData.type === "Run Out";
      const isRetiredHurt = isRetireEvent && wicketData.type === "Retired Hurt";
      const isRetiredOut = isRetireEvent && wicketData.type === "Retired Out";

      if (!wicket && !isRetireEvent && !wide && !noBall && striker && nonStriker && runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];

      if (isRunOut || isRetiredOut || isRetiredHurt) {
        const dismissedName = wicketData.dismissed;
        const survivor = dismissedName === stage.live.striker ? stage.live.nonStriker : stage.live.striker;
        if (dismissedName === stage.live.striker) striker = "";
        if (dismissedName === stage.live.nonStriker) nonStriker = "";
        incomingSlot = dismissedName === stage.live.striker ? "striker" : "nonStriker";
        if (isRunOut) {
          const outEnd = wicketData.outEnd || (dismissedName === stage.live.striker ? "striker" : "nonStriker");
          if (remaining.length <= 1) {
            striker = remaining[0] || survivor;
            nonStriker = "";
            incomingSlot = "solo";
          } else {
            striker = outEnd === "striker" ? "" : survivor;
            nonStriker = outEnd === "nonStriker" ? "" : survivor;
            incomingSlot = outEnd;
          }
        } else if (remaining.length <= 1) {
          striker = remaining[0] || survivor;
          nonStriker = "";
          incomingSlot = "solo";
        }
      } else if (wicket) {
        const dismissedName = wicketData.dismissed;
        const slot = dismissedName === stage.live.striker ? "striker" : "nonStriker";
        if (slot === "striker") striker = ""; else nonStriker = "";
        if (remaining.length <= 1 || nextScore.wickets >= maxWickets - 1) {
          striker = remaining[0] || "";
          nonStriker = "";
          incomingSlot = "solo";
        } else {
          incomingSlot = slot;
        }
      }

      if (overEnded) {
        if (remaining.length <= 1 || nextScore.wickets >= maxWickets - 1) {
          striker = remaining[0] || striker;
          nonStriker = "";
        } else if (striker && nonStriker && !wicket && !isRetireEvent) {
          [striker, nonStriker] = [nonStriker, striker];
        }
        bowler = "";
      }

      const targetReached = stage.innings.length === 2 && target != null && nextScore.runs >= target;
      const inningsDone = nextScore.wickets >= maxWickets || nextScore.legal >= maxOvers * 6 || targetReached;
      const nextInnings = [...stage.innings];
      nextInnings[nextInnings.length - 1] = { ...inn, deliveries };
      const hurtList = unique([...(stage.live.retiredHurt || [])]);
      if (isRetiredHurt && dismissedNameExists(wicketData.dismissed)) hurtList.push(wicketData.dismissed);
      const live = { ...stage.live, striker, nonStriker, bowler, previousBowler: overEnded ? stage.live.bowler : stage.live.previousBowler, freeHit: isRetireEvent ? stage.live.freeHit : (noBall ? true : (legal ? false : stage.live.freeHit)), retiredHurt: unique(hurtList) };

      if (inningsDone && nextInnings.length === 1) return { ...current, ...(isSuper ? { superOvers: replaceStage(current.superOvers, superOverIndex - 1, { ...stage, status: "innings2", innings: nextInnings, live: { ...live, striker: "", nonStriker: "", bowler: "" } }) } : { status: "innings2", innings: nextInnings, live: { ...live, striker: "", nonStriker: "", bowler: "" } }) };
      if (inningsDone && nextInnings.length === 2) {
        const completedStage = { ...stage, status: "completed", innings: nextInnings, live: { ...live, striker: "", nonStriker: "", bowler: "" } };
        const resultValue = describeResult(completedStage, { maxOvers, maxWickets });
        if (isSuper) {
          const root = { ...current, superOvers: replaceStage(current.superOvers, superOverIndex - 1, { ...completedStage, result: resultValue }) };
          if (resultValue.winner !== "tie") root.finalResult = { winner: resultValue.winner, stage: superOverIndex, desc: `${resultValue.winner} won Super Over ${superOverIndex}` };
          return root;
        }
        return { ...current, status: "completed", innings: nextInnings, live: emptyLive(), result: { ...resultValue, t1: nextInnings[0].battingTeam, t2: nextInnings[1].battingTeam, t1Runs: computeInnings(nextInnings[0].deliveries).runs, t2Runs: computeInnings(nextInnings[1].deliveries).runs } };
      }
      const updatedStage = { ...stage, status: "live", innings: nextInnings, live };
      return isSuper ? { ...current, superOvers: replaceStage(current.superOvers, superOverIndex - 1, updatedStage) } : { ...current, innings: nextInnings, live, status: "live" };
    });

    pushResult(result);
    const resultingStage = isSuper ? normaliseStage(result.next.superOvers?.[superOverIndex - 1], superOverIndex, teams) : { ...result.next, innings: result.next.innings || [] };
    const resultingInn = resultingStage.innings?.at(-1);
    const resultingScore = resultingInn ? computeInnings(deliveryList(resultingInn.deliveries), { maxOvers, maxWickets }) : score;
    const resultingHurt = unique(resultingStage.live?.retiredHurt || []);

    if (resultingStage.status === "innings2") {
      setNewBatsmanOpen(false);
      setWicketOpen(false);
      setToast("First innings complete");
      return;
    }
    if (resultingStage.status === "completed") {
      setNewBatsmanOpen(false);
      setWicketOpen(false);
      setToast(resultingStage.result?.winner === "tie" ? "Stage tied" : `${resultingStage.result?.winner} wins`);
      return;
    }

    if (incomingSlot === "solo") {
      setNewBatsmanOpen(false);
      setNewBatsmanChoices([]);
      setNewBatsman("");
      setNewBatsmanSlot("");
      setNewBatsmanExcluded("");
      setToast(`${resultingStage.live?.striker || "Last batter"} is now the sole striker`);
      return;
    }
    if ((wicket || retired) && incomingSlot && resultingStage.live?.[incomingSlot] === "") {
      const resultingDismissedPlayers = unique((resultingInn?.deliveries || []).filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
      const available = unique(activeBattingPlayers.filter((p) => p !== resultingStage.live?.striker && p !== resultingStage.live?.nonStriker && p !== wicketData.dismissed && !resultingDismissedPlayers.includes(p)));
      setNewBatsmanChoices(available);
      setNewBatsman(available[0] || "");
      setNewBatsmanSlot(incomingSlot);
      setNewBatsmanExcluded(wicketData.dismissed);
      setNewBatsmanOpen(true);
      setToast(retired ? (wicketData.type === "Retired Hurt" ? "Retired hurt — no wicket" : "Retired out — wicket recorded") : (isRunOutText(wicketData.type) ? "Run out recorded" : "Wicket recorded"));
    } else if (wide) setToast("WIDE");
    else if (noBall) setToast("NO BALL");
    else if (runs === 6) setToast("SIX");
    else if (runs === 4) setToast("FOUR");

    if (resultingScore.wickets >= 2 && resultingHurt.length) {
      setReturnPlayer(resultingHurt[0]);
      setReturnOpen(true);
    }
  };

  const openWicketModal = (event) => {
    if (!isLive) return;
    const selected = currentStage.live.striker || currentStage.live.nonStriker;
    if (!selected) return setToast("No current batter to dismiss");
    if (!currentStage.live.bowler) return setToast("Select a bowler before recording a wicket");
    setWicketDraft({ dismissed: selected, type: "Bowled", outEnd: "striker", fielder: "" });
    setWicketOrigin(originFromEvent(event));
    setWicketOpen(true);
  };

  const submitWicket = () => {
    const dismissed = wicketDraft.dismissed;
    if (!dismissed || ![currentStage.live.striker, currentStage.live.nonStriker].filter(Boolean).includes(dismissed)) return setToast("Choose a current batter");
    const fielder = wicketDraft.fielder;
    const text = `${wicketDraft.type}${fielder ? `, ${fielder}` : ""}`;
    setWicketOpen(false);
    addDelivery(0, { wicket: true, wicketData: { ...wicketDraft, dismissed, fielder, outEnd: wicketDraft.type === "Run Out" ? wicketDraft.outEnd : dismissed === currentStage.live.striker ? "striker" : "nonStriker", text } });
  };

  const openRetirement = (type, event) => {
    if (!isLive) return;
    const candidates = [currentStage.live.striker, currentStage.live.nonStriker].filter(Boolean);
    if (!candidates.length) return setToast("No current batter is available");
    setRetirementType(type);
    setRetirementPlayer(candidates[0]);
    setRetirementOrigin(originFromEvent(event));
    setRetirementOpen(true);
  };

  const submitRetirement = () => {
    if (!retirementPlayer) return setToast("Choose a batter");
    setRetirementOpen(false);
    addDelivery(0, { retired: true, wicketData: { type: retirementType, dismissed: retirementPlayer, text: retirementType } });
  };

  const confirmNewBatsman = (selectedValue = newBatsman) => {
    const selected = selectedValue || newBatsman;
    if (!selected || !newBatsmanChoices.includes(selected)) return setToast("Please select a new batsman");
    const result = patchMatch(matchId, (current) => {
      if (isSuper) {
        const stages = [...(current.superOvers || [])];
        const stage = normaliseStage(stages[superOverIndex - 1], superOverIndex, teams);
        const inn = stage.innings?.at(-1);
        const dismissedNow = unique(deliveryList(inn?.deliveries).filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
        const live = stage.live || emptyLive();
        const incoming = stage.live?.[newBatsmanSlot];
        const players = unique(teams[inn?.battingTeam]?.players || activeBattingPlayers);
        const eligible = players.filter((p) => p !== live.striker && p !== live.nonStriker && !dismissedNow.includes(p) && p !== newBatsmanExcluded);
        if (incoming) return current;
        if (!eligible.includes(selected)) return current;
        stages[superOverIndex - 1] = { ...stage, live: { ...live, [newBatsmanSlot]: selected } };
        return { ...current, superOvers: stages };
      }
      const inn = Array.isArray(current.innings) ? current.innings.at(-1) : null;
      const dismissedNow = unique(deliveryList(inn?.deliveries).filter((d) => (d.wicket || d.retired) && d.dismissed).map((d) => d.dismissed));
      const live = current.live || emptyLive();
      const players = unique(teams[inn?.battingTeam]?.players || activeBattingPlayers);
      const eligible = players.filter((p) => p !== live.striker && p !== live.nonStriker && !dismissedNow.includes(p) && p !== newBatsmanExcluded);
      if (live?.[newBatsmanSlot]) return current;
      if (!eligible.includes(selected)) return current;
      return { ...current, live: { ...live, [newBatsmanSlot]: selected } };
    });
    const applied = isSuper
      ? result.next.superOvers?.[superOverIndex - 1]?.live?.[newBatsmanSlot] === selected
      : result.next.live?.[newBatsmanSlot] === selected;
    if (!applied) return setToast("That batter is no longer available");
    pushResult(result, `${selected} comes in`);
    setNewBatsmanOpen(false); setNewBatsman(""); setNewBatsmanSlot(""); setNewBatsmanExcluded(""); setNewBatsmanChoices([]);
  };

  const applyManualAdjustment = (team, amount) => {
    const delta = Number(amount) || 0;
    if (!team || ![fixture.t1, fixture.t2].includes(team) || !delta) return setToast("Choose a team and adjustment");
    const result = patchMatch(matchId, (current) => {
      const stage = isSuper
        ? normaliseStage(current.superOvers?.[superOverIndex - 1], superOverIndex, teams)
        : {
          status: current.status,
          innings: Array.isArray(current.innings) ? current.innings : [],
          live: current.live || emptyLive(),
          result: current.result,
          manualAdjustments: current.manualAdjustments?.main || {}
        };
      const adjustments = { ...(stage.manualAdjustments || {}) };
      const previousAdjustment = Number(adjustments[team]) || 0;
      const targetInn = stage.innings?.findLast?.((inn) => inn?.battingTeam === team) || [...(stage.innings || [])].reverse().find((inn) => inn?.battingTeam === team);
      const baseScore = targetInn ? computeInnings(deliveryList(targetInn.deliveries), { maxOvers, maxWickets, manualAdjustment: previousAdjustment }) .runs : 0;
      if (baseScore + delta < 0) return current;
      adjustments[team] = previousAdjustment + delta;
      if (isSuper) {
        const nextStage = { ...stage, manualAdjustments: adjustments };
        if (nextStage.innings?.length >= 2) nextStage.result = describeResult(nextStage, { maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS, manualAdjustments: adjustments });
        const stages = [...(current.superOvers || [])];
        stages[superOverIndex - 1] = nextStage;
        return { ...current, superOvers: stages };
      }
      const next = { ...current, manualAdjustments: { ...(current.manualAdjustments || {}), main: adjustments } };
      if (next.innings?.length >= 2) next.result = describeResult(next, { maxOvers: MAX_OVERS, maxWickets: MAX_WICKETS, manualAdjustments: adjustments });
      return next;
    });
    const currentAdjustments = Number((isSuper ? result.next?.superOvers?.[superOverIndex - 1]?.manualAdjustments?.[team] : result.next?.manualAdjustments?.main?.[team]) || 0);
    const previousAdjustments = Number((isSuper ? result.previous?.superOvers?.[superOverIndex - 1]?.manualAdjustments?.[team] : result.previous?.manualAdjustments?.main?.[team]) || 0);
    if (currentAdjustments !== previousAdjustments + delta) return setToast("That adjustment would make the score negative");
    pushResult(result, `${team} ${delta > 0 ? "+" : ""}${delta} run${Math.abs(delta) === 1 ? "" : "s"}`);
    setManualAdjustOpen(false);
  };

  const selectBowler = (name) => {
    if (!name || name === currentStage.live.previousBowler) return setToast("That bowler just bowled the current over");
    const result = isSuper
      ? patchMatch(matchId, (current) => { const stages = [...(current.superOvers || [])]; const stage = normaliseStage(stages[superOverIndex - 1], superOverIndex, teams); stages[superOverIndex - 1] = { ...stage, live: { ...stage.live, bowler: name } }; return { ...current, superOvers: stages }; })
      : patchMatch(matchId, (current) => ({ ...current, live: { ...current.live, bowler: name } }));
    pushResult(result, `${name} starts the new over`); setBowlerOpen(false);
  };

  const bringBackHurt = () => {
    const candidate = returnPlayer || retiredHurt[0];
    if (!candidate || !retiredHurt.includes(candidate)) return setToast("Choose a retired-hurt player");
    const slot = currentStage.live.striker ? (currentStage.live.nonStriker ? "striker" : "nonStriker") : "striker";
    const result = isSuper
      ? patchMatch(matchId, (current) => { const stages = [...(current.superOvers || [])]; const stage = normaliseStage(stages[superOverIndex - 1], superOverIndex, teams); stages[superOverIndex - 1] = { ...stage, live: { ...stage.live, [slot]: candidate, retiredHurt: stage.live.retiredHurt.filter((p) => p !== candidate) } }; return { ...current, superOvers: stages }; })
      : patchMatch(matchId, (current) => ({ ...current, live: { ...current.live, [slot]: candidate, retiredHurt: (current.live?.retiredHurt || []).filter((p) => p !== candidate) } }));
    pushResult(result, `${candidate} returns from retired hurt`); setReturnOpen(false); setReturnPlayer("");
  };

  const endInningsFromHurt = () => {
    const result = patchMatch(matchId, (current) => {
      if (isSuper) {
        const stages = [...(current.superOvers || [])];
        const stage = normaliseStage(stages[superOverIndex - 1], superOverIndex, teams);
        if (stage.innings.length < 2) {
          stages[superOverIndex - 1] = { ...stage, status: "innings2", live: { ...stage.live, striker: "", nonStriker: "", bowler: "" } };
          return { ...current, superOvers: stages };
        }
        const completed = { ...stage, status: "completed", live: emptyLive() };
        const resultValue = describeResult(completed, { maxOvers: SUPER_OVER_MAX_OVERS, maxWickets: SUPER_OVER_MAX_WICKETS });
        stages[superOverIndex - 1] = { ...completed, result: resultValue };
        return { ...current, superOvers: stages, ...(resultValue.winner !== "tie" ? { finalResult: { winner: resultValue.winner, stage: superOverIndex, desc: `${resultValue.winner} won Super Over ${superOverIndex}` } } : {}) };
      }
      if ((current.innings || []).length < 2) {
        return { ...current, status: "innings2", live: { ...(current.live || emptyLive()), striker: "", nonStriker: "", bowler: "" } };
      }
      const completed = { ...current, status: "completed", live: emptyLive() };
      const resultValue = describeResult(completed, { maxOvers: MAX_OVERS, maxWickets: MAX_WICKETS });
      return { ...completed, result: resultValue };
    });
    pushResult(result, "Innings ended"); setReturnOpen(false);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return setToast("Nothing to undo");
    const redoTarget = clone(state);
    const result = patchMatch(matchId, previous);
    const mandatory = inspectMandatoryState(result.next);
    setHistory((h) => h.slice(0, -1));
    setRedoSnapshot(redoTarget);
    setRedoSeconds(10);
    setWicketOpen(false);
    setBowlerOpen(false);
    setReturnOpen(false);
    setNewBatsmanOpen(false);
    setNewBatsmanChoices([]);
    setMandatoryUndoType(mandatory?.type || "");
    setState(clone(result.next));

    if (mandatory?.type === "newBatsman") {
      setNewBatsmanChoices(mandatory.choices);
      setNewBatsman(mandatory.choices[0] || "");
      setNewBatsmanSlot(mandatory.slot);
      setNewBatsmanExcluded(mandatory.excluded || "");
      setNewBatsmanOpen(true);
    } else if (mandatory?.type === "return") {
      setReturnPlayer(mandatory.player || "");
      setReturnOpen(true);
    }
    setToast(mandatory ? "Undo paused at a required choice" : "Last action undone");
  };

  const redo = () => {
    if (!redoSnapshot) return;
    const target = clone(redoSnapshot);
    const result = patchMatch(matchId, target);
    setHistory((h) => [...h, result.previous].slice(-40));
    clearRedo();
    setMandatoryUndoType("");
    setWicketOpen(false);
    setBowlerOpen(false);
    setReturnOpen(false);
    setNewBatsmanOpen(false);
    setNewBatsmanChoices([]);
    setState(result.next);
    setToast("Action redone");
  };

  const resumeUndoing = () => {
    setMandatoryUndoType("");
    setWicketOpen(false);
    setNewBatsmanOpen(false);
    setNewBatsmanChoices([]);
    setBowlerOpen(false);
    setReturnOpen(false);
    window.setTimeout(() => undo(), 0);
  };

  const reset = () => {
    if (!window.confirm(`Reset ${fixture.label}?`)) return;
    const result = patchMatch(matchId, () => ({ status: "upcoming", innings: [], live: emptyLive(), result: null, finalResult: null, toss: null, superOvers: [] }));
    setState(result.next); setHistory([]); clearRedo(); setMandatoryUndoType(""); setNewBatsmanOpen(false); setNewBatsmanChoices([]); setReturnOpen(false); setToast("Match reset");
  };

  const currentResult = isSuper ? stageResult(currentStage) : state.result;
  const allStages = [
    { label: "MAIN MATCH", innings: Array.isArray(state.innings) ? state.innings : [], result: state.result },
    ...rootSuperOvers.map((stage, index) => ({ label: `SUPER OVER ${index + 1}`, innings: stage.innings || [], result: stage.result || stageResult(stage) }))
  ];
  const nextSuperIndex = isSuper ? superOverIndex + 1 : 1;
  const tiedStage = currentResult?.winner === "tie";
  const winnerText = state.finalResult?.winner || (currentResult?.winner && currentResult.winner !== "tie" ? currentResult.winner : null);

  const setupModel = { teams, fixture, isSuper, currentStage, state, superOverIndex, startMainFirstInnings, startSecondInnings, startSuperFirstInnings, startSuperSecondInnings };

  return <SiteFrame active="matches"><main className="section-wrap page-section scorer-page match-experience-page">
    <div className="scorer-topline"><a className="back-button" href={matchPath(matchId)}>← Viewer</a><div className="scorer-title"><span>{fixture.label} / {isSuper ? `SUPER OVER ${superOverIndex}` : "OFFICIALS"}</span><ComicTitle>The <i>DRAFTS</i> / Scorer</ComicTitle></div><div className="scorer-actions"><button className="small-control blue-control undo-button" onClick={undo} disabled={!history.length}>Undo {history.length}</button>{redoSnapshot && <button className="small-control accent-control redo-button" onClick={redo} aria-label={`Redo action, ${redoSeconds} seconds remaining`}>Redo {redoSeconds}s</button>}<button className="small-control red-control undo-button reset-action" onClick={reset}>Reset</button></div></div>

    <div className="scoreboard-hero comic-panel dark-panel"><div className="scoreboard-team"><span className="compact-bat-icon" aria-hidden="true">▱</span><TeamBadge code={currentInn?.battingTeam || (isSuper ? currentStage.battingFirst : fixture.t1)} large teams={teams} /><small>Batting</small></div><div className="score-main"><span className="score-state state-live">LIVE</span><strong>{score.runs}<em>/<WicketCount wickets={score.wickets} deliveries={currentInn?.deliveries || []} retiredHurt={retiredHurt} /></em></strong><span>{score.overs}.{score.balls} / {maxOvers} over{maxOvers === 1 ? "" : "s"} {target ? `· target ${target}` : ""}</span></div><div className="scoreboard-team"><TeamBadge code={currentInn?.bowlingTeam || (isSuper ? currentStage.bowlingFirst : fixture.t2)} large teams={teams} /><small>Bowling</small></div></div>

    {!isSuper && state.status === "upcoming" && <Setup fixture={fixture} teams={teams} setupModel={setupModel} />}
    {!isSuper && state.status === "innings2" && firstScore && <SecondInningsSetup battingTeam={state.innings[0].bowlingTeam} bowlingTeam={state.innings[0].battingTeam} teams={teams} onStart={(setup) => startSecondInnings(setup)} />}
    {isSuper && !hasStartedStage && (currentStage.battingFirst && currentStage.bowlingFirst
      ? <SuperOverSetup teams={teams} stage={currentStage} onStart={(setup) => startSuperFirstInnings(setup)} />
      : <section className="comic-panel paper-panel setup-panel setup-pending"><span className="panel-kicker">SUPER OVER {superOverIndex} / SETUP</span><p>Preparing the tied teams and opening-player choices…</p></section>)}
    {isSuper && currentStage.status === "innings2" && firstScore && <SecondInningsSetup battingTeam={stageInnings[0].bowlingTeam} bowlingTeam={stageInnings[0].battingTeam} teams={teams} onStart={(setup) => startSuperSecondInnings(setup)} />}

    {isLive && currentInn && <>
      <section className="comic-panel dark-panel active-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">{isSuper ? `SUPER OVER ${superOverIndex} / LIVE CONTROL` : "LIVE CONTROL"}</span><ComicTitle as="h2">{currentInn.battingTeam} batting</ComicTitle><div className="compact-innings-identity"><span className="compact-bat-icon" aria-hidden="true">▱</span><TeamBadge code={currentInn.battingTeam} teams={teams} /><b>{currentInn.battingTeam}</b></div></div><span className="live-chip"><i /> LIVE</span></div>
        <div className="player-strip compact-player-strip"><div className="player-box active-player compact-player-card"><span>STRIKER</span><b>{currentStage.live.striker || "Incoming batter"}</b>{soloBatter && <em>SOLE BATTER — ALWAYS ON STRIKE</em>}</div><div className="player-box compact-player-card"><span>NON-STRIKER</span><b>{currentStage.live.nonStriker || (soloBatter ? "—" : "Incoming batter")}</b></div><div className="player-box bowler-box compact-player-card"><span>BOWLER</span><b>{currentStage.live.bowler || "New over"}</b></div><div className="ball-results-strip compact-over-strip" aria-label={`Ball results for over ${score.overs || 0}`}><span className="over-chip">OVER {score.overs || 0}</span>{currentOverDeliveries(currentInn?.deliveries || []).map((delivery, index) => <span key={`ball-result-${index}`} className={`ball-result-dot ${deliveryResultClass(delivery)}`}>{deliveryResultLabel(delivery)}</span>)}{!currentOverDeliveries(currentInn?.deliveries || []).length && <span className="ball-result-empty">No balls yet</span>}</div></div>
        {!currentStage.live.bowler && <div className="new-over-control"><span>OVER COMPLETE / BOWLER CHANGE</span><button className="comic-button primary" onClick={(e) => { setBowlerOrigin(originFromEvent(e)); setBowlerOpen(true); }}>Select new bowler <span>→</span></button></div>}
        <div className="run-pad">{[0,1,2,3,4,5,6].map((r) => <button key={`run-${r}`} className="run-key run-family" disabled={!currentStage.live.bowler} onClick={() => addDelivery(r)}>{r}</button>)}</div>
        <div className={`special-run-row ${expandedExtra ? `is-${expandedExtra}` : ""}`}>
          {expandedExtra === "wide" ? <div className="extra-morph-group">
            <button className="extra-cancel" aria-label="Close wide options" onClick={() => setExpandedExtra("")}>×</button>
            {[0,1,2,3,4].map((r) => <button key={`wide-${r}`} className="extra-option wide-family" disabled={!currentStage.live.bowler} onClick={() => { addDelivery(r, { wide: true }); setExpandedExtra(""); }}>{r === 0 ? "WIDE" : `WIDE+${r}`}</button>)}
          </div> : expandedExtra === "noBall" ? <div className="extra-morph-group">
            <button className="extra-cancel" aria-label="Close no-ball options" onClick={() => setExpandedExtra("")}>×</button>
            {[0,1,2,3,4,5,6].map((r) => <button key={`nb-${r}`} className="extra-option nb-family" disabled={!currentStage.live.bowler} onClick={() => { addDelivery(r, { noBall: true }); setExpandedExtra(""); }}>{r === 0 ? "NO BALL" : `NB+${r}`}</button>)}
          </div> : <>
            <button className="run-key wide-family" disabled={!currentStage.live.bowler} onClick={() => setExpandedExtra("wide")}>WIDE</button>
            <button className="run-key nb-family" disabled={!currentStage.live.bowler} onClick={() => setExpandedExtra("noBall")}>NO BALL</button>
            <button className="run-key wicket-key" disabled={!currentStage.live.bowler} onClick={openWicketModal}>WICKET</button>
          </>}
        </div>
        <div className="retirement-actions"><button className="retirement-action retirement-hurt-button" disabled={!currentStage.live.bowler} onClick={(e) => openRetirement("Retired Hurt", e)}>RETIRED HURT</button><button className="retirement-action retirement-out-button" disabled={!currentStage.live.bowler} onClick={(e) => openRetirement("Retired Out", e)}>RETIRED OUT</button></div>
        <div className="scoring-tools"><span>Free hit: <b>{currentStage.live.freeHit ? "ON" : "OFF"}</b></span><span>{score.legal} legal balls</span></div>
      </section>
      <section className="scorer-lower"><article className="comic-panel paper-panel commentary-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary</ComicTitle></div><button className="expand-button viewer-family" onClick={() => { setCommentaryOpen(true); }}>Expand ↗</button></div><div className="compact-secondary-row"><span className="compact-secondary-row__title">COMMENTARY</span><button className="expand-button viewer-family" onClick={() => setCommentaryOpen(true)}>Expand ↗</button></div></article><article className="comic-panel paper-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">LIVE FIGURES</span><ComicTitle as="h2">Scorecard</ComicTitle></div><button className="expand-button scorecard-family" onClick={(e) => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); }}>Open ↗</button></div><div className="compact-secondary-row"><span className="compact-secondary-row__title">SCORECARD</span><button className="expand-button scorecard-family" onClick={(e) => { setScorecardOrigin(originFromEvent(e)); setScorecardOpen(true); }}>Open ↗</button></div></article></section>
      <PlayerStats state={{ ...state, innings: stageInnings, superOvers: isSuper ? [] : state.superOvers }} teamCodes={[fixture.t1, fixture.t2]} teams={teams} mode="scorer" />
    </>}

    {currentStage.status === "completed" || (!isSuper && state.status === "completed") ? <ResultPanel fixture={fixture} teams={teams} matchId={matchId} state={state} isSuper={isSuper} superOverIndex={superOverIndex} stage={currentStage} allStages={allStages} winnerText={winnerText} tiedStage={tiedStage} nextSuperIndex={nextSuperIndex} onScorecard={() => { setScorecardOrigin(null); setScorecardOpen(true); }} manualAdjustments={state.manualAdjustments || { main: {}, superOvers: [] }} /> : null}

    <div className="scorer-footer"><div className="scorer-footer-tools"><span>OFFICIAL TOOLS</span><button className="comic-button tertiary manual-edit-button" onClick={() => { setManualAdjustTeam(fixture.t1); setManualAdjustAmount(1); setManualAdjustOpen(true); }}>EDIT MANUALLY</button></div><div className="scorer-footer-links"><a className="comic-button secondary" href={matchPath(matchId)}>Public viewer ↗</a><button className="comic-button tertiary" onClick={() => setCommentaryOpen(true)}>Open commentary ↗</button></div></div>

    {wicketOpen && <WicketModal origin={wicketOrigin} state={{ live: currentStage.live }} battingPlayers={activeBattingPlayers} bowlingPlayers={activeBowlingPlayers} draft={wicketDraft} setDraft={setWicketDraft} onClose={() => setWicketOpen(false)} onSubmit={submitWicket} />}
    {retirementOpen && <RetirementModal origin={retirementOrigin} type={retirementType} player={retirementPlayer} players={[currentStage.live.striker, currentStage.live.nonStriker].filter(Boolean)} onChange={setRetirementPlayer} onClose={() => setRetirementOpen(false)} onSubmit={submitRetirement} />}
    {newBatsmanOpen && <NewBatsmanModal choices={newBatsmanChoices} value={newBatsman} setValue={setNewBatsman} slot={newBatsmanSlot} onClose={() => setNewBatsmanOpen(false)} onSubmit={confirmNewBatsman} allowResumeUndo={mandatoryUndoType === "newBatsman"} onResumeUndo={resumeUndoing} />}
    {bowlerOpen && <BowlerModal bowlingPlayers={activeBowlingPlayers} currentInn={currentInn} previousBowler={currentStage.live.previousBowler} onSelect={selectBowler} onClose={() => setBowlerOpen(false)} />}
    {returnOpen && <RetiredHurtReturnModal players={retiredHurt} value={returnPlayer} setValue={setReturnPlayer} onBringBack={bringBackHurt} onEnd={endInningsFromHurt} onClose={() => setReturnOpen(false)} allowResumeUndo={mandatoryUndoType === "return"} onResumeUndo={resumeUndoing} />}
    {manualAdjustOpen && <ManualAdjustmentModal teams={fixture} team={manualAdjustTeam} amount={manualAdjustAmount} onTeamChange={setManualAdjustTeam} onAmountChange={setManualAdjustAmount} onClose={() => setManualAdjustOpen(false)} onSubmit={applyManualAdjustment} />}
    {commentaryOpen && <Modal onClose={() => setCommentaryOpen(false)} className="commentary-modal dark-panel" ariaLabel="Commentary archive"><div className="panel-heading modal-heading"><div><span className="panel-kicker">BALL BY BALL</span><ComicTitle as="h2">Commentary archive</ComicTitle></div><button className="expand-button close-button" onClick={() => setCommentaryOpen(false)}>Close ×</button></div><div className="modal-scroll-content commentary-modal-scroll"><Commentary deliveries={currentInn?.deliveries || []} /></div></Modal>}
    {scorecardOpen && <ScorecardModal innings={state.innings || []} superOvers={rootSuperOvers} origin={scorecardOrigin} onClose={() => setScorecardOpen(false)} manualAdjustments={state.manualAdjustments || { main: {}, superOvers: [] }} />}
    {toast && <div className="toast">{toast}</div>}
  </main></SiteFrame>;
}

function replaceStage(stages, index, stage) {
  const next = [...(stages || [])];
  next[index] = stage;
  return next;
}
function dismissedNameExists(name) { return Boolean(name); }
function isRunOutText(type) { return type === "Run Out"; }

function Setup({ fixture, teams, setupModel }) {
  const { setupState, setSetupState } = useSetupState(setupModel.fixture, teams);
  return <section className="comic-panel paper-panel setup-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">MATCH SETUP</span><ComicTitle as="h2">Set the opening players</ComicTitle></div><span className="format-stamp">3 WICKETS / 6 OVERS</span></div><SetupFields fixture={fixture} teams={teams} setup={setupState} setSetup={setSetupState} /><button className="comic-button primary wide-button" onClick={() => setupModel.startMainFirstInnings(setupState)}>Start Match <span>→</span></button></section>;
}

function useSetupState(fixture, teams) {
  const battingPlayers = teams[fixture.t1]?.players || [];
  const bowlingPlayers = teams[fixture.t2]?.players || [];
  const [setupState, setSetupState] = useState({ batting: fixture.t1, tossWinner: fixture.t1, tossDecision: "bat", striker: battingPlayers[0] || "", nonStriker: battingPlayers[1] || "", bowler: bowlingPlayers[0] || "" });
  const updateToss = (winner, decision) => { const batting = decision === "bat" ? winner : (winner === fixture.t1 ? fixture.t2 : fixture.t1); const bowling = batting === fixture.t1 ? fixture.t2 : fixture.t1; setSetupState((s) => ({ ...s, tossWinner: winner, tossDecision: decision, batting, striker: teams[batting]?.players?.[0] || "", nonStriker: teams[batting]?.players?.[1] || "", bowler: teams[bowling]?.players?.[0] || "" })); };
  return { setupState, setSetupState, updateToss, battingPlayers, bowlingPlayers };
}

function SetupFields({ fixture, teams, setup, setSetup }) {
  const bowling = setup.batting === fixture.t1 ? fixture.t2 : fixture.t1;
  const updateToss = (winner, decision) => { const batting = decision === "bat" ? winner : (winner === fixture.t1 ? fixture.t2 : fixture.t1); const bowl = batting === fixture.t1 ? fixture.t2 : fixture.t1; setSetup({ ...setup, tossWinner: winner, tossDecision: decision, batting, striker: teams[batting]?.players?.[0] || "", nonStriker: teams[batting]?.players?.[1] || "", bowler: teams[bowl]?.players?.[0] || "" }); };
  const battingPlayers = unique(teams[setup.batting]?.players || []);
  const bowlingPlayers = unique(teams[bowling]?.players || []);
  const changeStriker = (striker) => setSetup((s) => ({ ...s, striker, nonStriker: s.nonStriker === striker ? (battingPlayers.find((p) => p !== striker) || "") : s.nonStriker }));
  return <div className="setup-grid"><div className="setup-derived"><span>Batting first</span><strong>{setup.batting}</strong></div><div className="setup-derived"><span>Bowling first</span><strong>{bowling}</strong></div><label>Toss winner<select value={setup.tossWinner} onChange={(e) => updateToss(e.target.value, setup.tossDecision)}>{[fixture.t1, fixture.t2].map((team) => <option key={team}>{team}</option>)}</select></label><label>Toss decision<select value={setup.tossDecision} onChange={(e) => updateToss(setup.tossWinner, e.target.value)}><option value="bat">Bat first</option><option value="bowl">Bowl first</option></select></label><label>Striker<select value={setup.striker} onChange={(e) => changeStriker(e.target.value)}>{battingPlayers.map((p) => <option key={p}>{p}</option>)}</select></label><label>Non-striker<select value={setup.nonStriker} onChange={(e) => setSetup((s) => ({ ...s, nonStriker: e.target.value }))}>{battingPlayers.filter((p) => p !== setup.striker).map((p) => <option key={p}>{p}</option>)}</select></label><label>Bowler<select value={setup.bowler} onChange={(e) => setSetup((s) => ({ ...s, bowler: e.target.value }))}>{bowlingPlayers.map((p) => <option key={p}>{p}</option>)}</select></label></div>;
}

function SecondInningsSetup({ battingTeam, bowlingTeam, teams, onStart }) {
  const battingPlayers = unique(teams[battingTeam]?.players || []); const bowlingPlayers = unique(teams[bowlingTeam]?.players || []);
  const [setup, setSetup] = useState({ striker: battingPlayers[0] || "", nonStriker: battingPlayers[1] || "", bowler: bowlingPlayers[0] || "" });
  const changeStriker = (striker) => setSetup((s) => ({ ...s, striker, nonStriker: s.nonStriker === striker ? (battingPlayers.find((p) => p !== striker) || "") : s.nonStriker }));
  return <section className="innings-break comic-panel paper-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">INNINGS BREAK</span><ComicTitle as="h2">{battingTeam} is chasing.</ComicTitle></div><span className="format-stamp">SET OPENING PLAYERS</span></div><div className="setup-grid"><label>Striker<select value={setup.striker} onChange={(e) => changeStriker(e.target.value)}>{battingPlayers.map((p) => <option key={p}>{p}</option>)}</select></label><label>Non-striker<select value={setup.nonStriker} onChange={(e) => setSetup((s) => ({ ...s, nonStriker: e.target.value }))}>{battingPlayers.filter((p) => p !== setup.striker).map((p) => <option key={p}>{p}</option>)}</select></label><label>Bowler<select value={setup.bowler} onChange={(e) => setSetup((s) => ({ ...s, bowler: e.target.value }))}>{bowlingPlayers.map((p) => <option key={p}>{p}</option>)}</select></label></div><button className="comic-button primary wide-button" onClick={() => onStart(setup)}>Start second innings <span>→</span></button></section>;
}

function SuperOverSetup({ teams, stage, onStart }) {
  const batting = stage.battingFirst; const bowling = stage.bowlingFirst;
  const battingPlayers = unique(teams[batting]?.players || []); const bowlingPlayers = unique(teams[bowling]?.players || []);
  const [setup, setSetup] = useState({ striker: battingPlayers[0] || "", nonStriker: battingPlayers[1] || "", bowler: bowlingPlayers[0] || "" });
  const changeStriker = (striker) => setSetup((s) => ({ ...s, striker, nonStriker: s.nonStriker === striker ? (battingPlayers.find((p) => p !== striker) || "") : s.nonStriker }));
  return <section className="comic-panel paper-panel setup-panel"><div className="panel-heading" data-anchor-heading><div><span className="panel-kicker">SUPER OVER {stage.index} / SETUP</span><ComicTitle as="h2">One over. Two wickets.</ComicTitle></div><span className="format-stamp">1 OVER / 2 WKTS</span></div><p>{batting} bats first; {bowling} bowls.</p><div className="setup-grid"><label>Striker<select value={setup.striker} onChange={(e) => changeStriker(e.target.value)}>{battingPlayers.map((p) => <option key={p}>{p}</option>)}</select></label><label>Non-striker<select value={setup.nonStriker} onChange={(e) => setSetup((s) => ({ ...s, nonStriker: e.target.value }))}>{battingPlayers.filter((p) => p !== setup.striker).map((p) => <option key={p}>{p}</option>)}</select></label><label>Bowler<select value={setup.bowler} onChange={(e) => setSetup((s) => ({ ...s, bowler: e.target.value }))}>{bowlingPlayers.map((p) => <option key={p}>{p}</option>)}</select></label></div><button className="comic-button primary wide-button" onClick={() => onStart(setup)}>Start Super Over <span>→</span></button></section>;
}

function WicketModal({ origin, state, battingPlayers, bowlingPlayers, draft, setDraft, onClose, onSubmit }) {
  const isRunOut = draft.type === "Run Out"; const fielderNeeded = ["Caught", "Run Out", "Stumped"].includes(draft.type);
  return <Modal origin={origin} onClose={onClose} className="wicket-modal paper-panel" ariaLabel="Dismissal control"><div className="modal-heading"><div><span className="panel-kicker">DISMISSAL CONTROL</span><ComicTitle as="h2">Record the wicket</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div><div className="modal-scroll-content"><div className="dismissed-lock"><span>DISMISSED BATTER</span>{isRunOut ? <div className="dismissal-player-choice">{[state.live.striker, state.live.nonStriker].filter(Boolean).map((p) => <button key={p} className={draft.dismissed === p ? "selected" : ""} onClick={() => setDraft((d) => ({ ...d, dismissed: p }))}>{p}</button>)}</div> : <div className="dismissed-fixed"><b>{draft.dismissed || state.live.striker}</b><span>Selected automatically.</span></div>}</div><label>Dismissal type<select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value, fielder: "" }))}>{DISMISSAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>{isRunOut && <label>Dismissed at<select value={draft.outEnd} onChange={(e) => setDraft((d) => ({ ...d, outEnd: e.target.value }))}><option value="striker">Striker's end</option><option value="nonStriker">Non-striker's end</option></select></label>}{fielderNeeded && <label>Fielder<select value={draft.fielder} onChange={(e) => setDraft((d) => ({ ...d, fielder: e.target.value }))}><option value="">Select fielder</option>{unique(bowlingPlayers).map((p) => <option key={p}>{p}</option>)}</select></label>}</div><div className="modal-actions"><button className="back-button viewer-family" onClick={onClose}>Cancel</button><button className="comic-button primary" onClick={onSubmit}>Confirm <span>→</span></button></div></Modal>;
}

function RetirementModal({ origin, type, player, players, onChange, onClose, onSubmit }) {
  return <Modal origin={origin} onClose={onClose} className="retirement-modal paper-panel" ariaLabel={type}><div className="modal-heading"><div><span className="panel-kicker">SPECIAL PLAYER STATUS</span><ComicTitle as="h2">{type}</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div><p>{type === "Retired Hurt" ? "No wicket is recorded. The player becomes eligible to return only after two wickets are down." : "Counts as an innings wicket, but not as a bowler wicket."}</p><label>Player<select value={player} onChange={(e) => onChange(e.target.value)}>{players.map((p) => <option key={p}>{p}</option>)}</select></label><div className="modal-actions"><button className="back-button viewer-family" onClick={onClose}>Cancel</button><button className="comic-button primary" onClick={onSubmit}>Confirm {type} <span>→</span></button></div></Modal>;
}

function RetiredHurtReturnModal({ players, value, setValue, onBringBack, onEnd, onClose, allowResumeUndo, onResumeUndo }) {
  return <Modal onClose={allowResumeUndo ? undefined : onClose} className="retirement-return-modal paper-panel" ariaLabel="Retired hurt return"><div className="modal-heading"><div><span className="panel-kicker">RETIREMENT / RETURN</span><ComicTitle as="h2">A batter is available to return.</ComicTitle></div>{!allowResumeUndo && <button className="modal-close-button close-button" onClick={onClose}>Close ×</button>}</div><p>{allowResumeUndo ? "Undo reached this required choice. Continue undoing to return to the previous normal state." : `${value || players[0] || "The retired-hurt player"} can return now because two wickets are down.`}</p>{!allowResumeUndo && <div className="retirement-player-choice">{players.map((p) => <button key={p} className={value === p ? "selected" : ""} onClick={() => setValue(p)}>{p}</button>)}</div>}{allowResumeUndo && <div className="incoming-slot mandatory-undo-note">MANDATORY CHOICE FROM UNDO</div>}<div className="modal-actions">{allowResumeUndo && <button className="comic-button secondary" onClick={onResumeUndo}>RESUME UNDOING</button>}<button className="comic-button primary" onClick={onBringBack}>BRING PLAYER BACK</button><button className="back-button viewer-family" onClick={onEnd}>END INNINGS</button></div></Modal>;
}

function ManualAdjustmentModal({ teams: fixture, team, amount, onTeamChange, onAmountChange, onClose, onSubmit }) {
  const teamCodes = [fixture.t1, fixture.t2];
  const amounts = [1, 2, 5, -5, -2, -1];
  const selectedFixtureTeams = fixture.teams || TEAMS;
  return <Modal onClose={onClose} className="manual-adjustment-modal paper-panel" ariaLabel="Manual score adjustment"><div className="modal-heading"><div><span className="panel-kicker">OFFICIAL OVERRIDE</span><ComicTitle as="h2">Edit score manually</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div><div className="modal-scroll-content"><p>Use this only for rule-based additions or deductions outside normal ball-by-ball scoring.</p><div className="manual-adjustment-group"><span className="manual-adjustment-label">TEAM</span><div className="manual-adjustment-team-grid">{teamCodes.map((code) => <button type="button" key={code} className={team === code ? "selected" : ""} onClick={() => onTeamChange(code)}><TeamBadge code={code} teams={selectedFixtureTeams} /><b>{selectedFixtureTeams?.[code]?.name || code}</b></button>)}</div></div><div className="manual-adjustment-group"><span className="manual-adjustment-label">RUN ADJUSTMENT</span><div className="manual-adjustment-amount-grid">{amounts.map((value) => <button type="button" key={value} className={amount === value ? "selected" : ""} onClick={() => onAmountChange(value)}>{value > 0 ? `+${value}` : value}</button>)}</div></div></div><div className="modal-actions"><button className="back-button viewer-family" onClick={onClose}>Cancel</button><button className="comic-button primary" onClick={() => onSubmit(team, amount)}>Apply {amount > 0 ? `+${amount}` : amount} to {team}</button></div></Modal>;
}

function NewBatsmanModal({ choices, value, setValue, slot, onClose, onSubmit, allowResumeUndo, onResumeUndo }) {
  const selected = value || choices[0] || "";
  const choose = (name) => setValue(name);
  return <Modal onClose={allowResumeUndo ? undefined : onClose} className="new-batsman-modal paper-panel" ariaLabel="Next batter"><div className="modal-heading"><div><span className="panel-kicker">NEXT BATTER</span><ComicTitle as="h2">Who walks in?</ComicTitle></div>{!allowResumeUndo && <button className="modal-close-button close-button" onClick={onClose}>Close ×</button>}</div>{allowResumeUndo && <p className="mandatory-undo-copy">Undo reached this required player choice. Continue undoing to return to the previous normal state.</p>}{choices.length ? <><label>Incoming batter<select value={selected} onChange={(e) => choose(e.target.value)}>{choices.map((p) => <option key={p} value={p}>{p}</option>)}</select></label><div className="incoming-player-grid" role="listbox" aria-label="Available batters">{choices.map((p) => <button type="button" role="option" aria-selected={selected === p} key={p} className={`player-pick ${selected === p ? "selected" : ""}`} onClick={() => choose(p)}><b>{p}</b><span>{selected === p ? "SELECTED" : "SELECT"}</span></button>)}</div></> : <p>No eligible batter remains.</p>}<div className="incoming-slot">{slot === "striker" ? "STRIKER'S END" : "NON-STRIKER'S END"}</div><div className="modal-actions">{allowResumeUndo && <button className="comic-button secondary" onClick={onResumeUndo}>RESUME UNDOING</button>}{!allowResumeUndo && <button className="back-button viewer-family" onClick={onClose}>Cancel</button>}{choices.length > 0 && <button className="comic-button primary" onClick={() => onSubmit(selected)} disabled={!selected}>Bring in <span>→</span></button>}</div></Modal>;}

function BowlerModal({ bowlingPlayers, currentInn, previousBowler, onSelect, onClose }) {
  const score = currentInn ? computeInnings(currentInn.deliveries) : { bowlers: {} };
  return <Modal onClose={onClose} className="bowler-modal paper-panel" ariaLabel="Select new bowler"><div className="modal-heading"><div><span className="panel-kicker">NEW OVER</span><ComicTitle as="h2">Select new bowler</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div><div className="bowler-choice-grid">{unique(bowlingPlayers).map((p) => { const f = score.bowlers[p] || { balls: 0, runs: 0, wickets: 0 }; const locked = p === previousBowler; return <button type="button" className={`player-pick ${locked ? "locked" : ""}`} key={p} disabled={locked} onClick={() => onSelect(p)}><b>{p}</b><small>{Math.floor(f.balls / 6)}.{f.balls % 6} OV · {f.runs} R · {f.wickets} W</small><span>{locked ? "JUST BOWLED" : "SELECT →"}</span></button>; })}</div></Modal>;
}

function ResultPanel({ fixture, teams, matchId, state, isSuper, superOverIndex, stage, allStages, winnerText, tiedStage, nextSuperIndex, onScorecard, manualAdjustments = { main: {}, superOvers: [] } }) {
  const title = winnerText ? `${winnerText} wins` : tiedStage ? (isSuper ? `Super Over ${superOverIndex} tied` : "Match tied") : `${stage.result?.winner || state.result?.winner} wins`;
  const description = stage.result?.desc || state.result?.desc || "";
  return <section className="result-panel comic-panel paper-panel"><span className="panel-kicker">{isSuper ? `SUPER OVER ${superOverIndex} COMPLETE` : "MATCH COMPLETE"}</span><ComicTitle as="h2">{title}</ComicTitle><p>{description}</p><div className="super-over-timeline">{allStages.filter((x) => x.innings?.length).map((x, index) => <div className="super-over-stage" key={`${x.label}-${index}`}><div className="super-over-stage__label">{x.label}</div><div className="result-scores">{x.innings.map((inn, i) => { const stageAdjustments = index === 0 ? (manualAdjustments.main || {}) : (manualAdjustments.superOvers?.[index - 1] || inn.manualAdjustments || {}); const c = computeInnings(inn.deliveries, { maxOvers: inn.maxOvers || (index ? SUPER_OVER_MAX_OVERS : MAX_OVERS), maxWickets: inn.maxWickets || (index ? SUPER_OVER_MAX_WICKETS : MAX_WICKETS), manualAdjustment: Number(stageAdjustments[inn.battingTeam]) || 0 }); return <div key={`${x.label}-${i}`}><TeamBadge code={inn.battingTeam} teams={teams} /><strong>{c.runs}/{c.wickets}</strong><span>({c.overs}.{c.balls})</span></div>; })}</div></div>)}</div><div className="result-actions">{tiedStage && <a className="comic-button primary super-over-button" href={scorerPath(matchId, nextSuperIndex)}>BEGIN SUPER OVER{nextSuperIndex > 1 ? ` ${nextSuperIndex}` : ""} ↗</a>}<button className="central-scorecard-button" onClick={onScorecard}>VIEW SCORECARD ↗</button></div></section>;
}

function NotFoundScorer() {
  return <SiteFrame active="matches"><main className="section-wrap page-section"><section className="future-note comic-panel paper-panel"><span className="panel-kicker">404 / SCORER NOT FOUND</span><ComicTitle as="h2">That fixture does not exist.</ComicTitle><p>Use the match archive to open a valid scorer page.</p><a className="comic-button primary" href={sitePath("/matches")}>Back to matches ↗</a></section></main></SiteFrame>;
}
