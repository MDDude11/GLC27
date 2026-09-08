import { MAX_OVERS, MAX_WICKETS, TEAMS } from "./data.js";

export const clone = (value) => JSON.parse(JSON.stringify(value));
export const isLegal = (d) => !d.wide && !d.noBall && !d.deadBall;
export const isRetirement = (d) => Boolean(d.retired);
export const isBowlerWicket = (d) => Boolean(d.wicket) && !d.retired && !d.deadBall && d.wicketType !== "Run Out";
export const isRecordedWicket = (d) => Boolean(d.wicket) && !d.retired && !d.deadBall;

const blankBatter = () => ({ runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: "", retired: false });
const blankBowler = () => ({ balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 });

export function computeInnings(deliveries = []) {
  let runs = 0;
  let wickets = 0;
  let legal = 0;
  let retirements = 0;
  const batters = {};
  const bowlers = {};
  const overRuns = [];
  const cumulative = [];
  let currentOverRuns = 0;
  let lastCompletedOver = 0;

  for (const d of deliveries) {
    const r = Number(d.runs) || 0;
    const wide = Boolean(d.wide);
    const noBall = Boolean(d.noBall);
    const dead = Boolean(d.deadBall);
    const legalBall = isLegal(d);
    const total = r + (wide ? 1 : 0) + (noBall ? 1 : 0);
    const out = isRecordedWicket(d);
    const retired = isRetirement(d);

    runs += total;
    currentOverRuns += total;
    if (legalBall) legal += 1;
    if (out) wickets += 1;
    if (retired) retirements += 1;

    if (d.striker && !wide && !retired) {
      batters[d.striker] ||= blankBatter();
      batters[d.striker].runs += r;
      if (legalBall) batters[d.striker].balls += 1;
      if (r === 4) batters[d.striker].fours += 1;
      if (r === 6) batters[d.striker].sixes += 1;
    }

    if ((out || retired) && d.dismissed) {
      batters[d.dismissed] ||= blankBatter();
      batters[d.dismissed].out = out;
      batters[d.dismissed].retired = retired;
      batters[d.dismissed].dismissal = d.dismissalText || d.wicketType || d.retirementType || "out";
    }

    if (d.bowler && !retired) {
      bowlers[d.bowler] ||= blankBowler();
      bowlers[d.bowler].runs += total;
      if (legalBall) bowlers[d.bowler].balls += 1;
      if (wide) bowlers[d.bowler].wides += 1;
      if (noBall) bowlers[d.bowler].noBalls += 1;
      if (isBowlerWicket(d)) bowlers[d.bowler].wickets += 1;
    }

    cumulative.push({ ball: deliveries.indexOf(d) + 1, runs });
    if (legalBall && legal % 6 === 0) {
      overRuns.push(currentOverRuns);
      currentOverRuns = 0;
      lastCompletedOver += 1;
    }
  }
  if (deliveries.length && (legal % 6 !== 0 || currentOverRuns !== 0) && overRuns.length < MAX_OVERS) overRuns.push(currentOverRuns);

  return {
    runs,
    wickets,
    retirements,
    legal,
    overs: Math.floor(legal / 6),
    balls: legal % 6,
    limitOvers: MAX_OVERS,
    limitBalls: MAX_OVERS * 6,
    batters,
    bowlers,
    overRuns,
    cumulative,
    completedOvers: lastCompletedOver
  };
}

export function inningsFinished(inn, target = null) {
  return inn.wickets >= MAX_WICKETS || inn.legal >= MAX_OVERS * 6 || (target != null && inn.runs >= target);
}

export function describeResult(match) {
  const a = computeInnings(match.innings[0]?.deliveries || []);
  const b = computeInnings(match.innings[1]?.deliveries || []);
  const t1 = match.innings[0]?.battingTeam || "";
  const t2 = match.innings[1]?.battingTeam || "";
  if (b.runs > a.runs) return { winner: t2, desc: `${t2} won by ${Math.max(0, MAX_WICKETS - b.wickets)} wicket${MAX_WICKETS - b.wickets === 1 ? "" : "s"}` };
  if (a.runs > b.runs) return { winner: t1, desc: `${t1} won by ${a.runs - b.runs} run${a.runs - b.runs === 1 ? "" : "s"}` };
  return { winner: "tie", desc: "Match tied" };
}

export function playerStats(state, innings = null, player = "") {
  const inn = innings || state?.innings?.[state.innings.length - 1];
  if (!inn || !player) return null;
  const c = computeInnings(inn.deliveries);
  const batting = c.batters[player] || blankBatter();
  const bowling = c.bowlers[player] || blankBowler();
  return {
    batting,
    bowling,
    strikeRate: batting.balls ? ((batting.runs / batting.balls) * 100).toFixed(2) : "0.00",
    economy: bowling.balls ? (bowling.runs / (bowling.balls / 6)).toFixed(2) : "0.00"
  };
}

export function activeBatters(state) {
  const inn = state?.innings?.at(-1);
  if (!inn) return [];
  const score = computeInnings(inn.deliveries);
  return [state.live?.striker, state.live?.nonStriker].filter(Boolean).map((name) => [name, score.batters[name] || blankBatter()]);
}

export function fallOfWickets(deliveries = []) {
  return deliveries
    .filter((d) => isRecordedWicket(d))
    .map((d) => ({
      dismissed: d.dismissed || "Unknown",
      wicketType: d.wicketType || "Out",
      bowler: d.wicketType === "Run Out" ? "" : d.bowler || "",
      fielder: d.fielder || ""
    }));
}

export function currentBowler(state) {
  const inn = state?.innings?.at(-1);
  if (!inn || !state.live?.bowler) return null;
  const score = computeInnings(inn.deliveries);
  return [state.live.bowler, score.bowlers[state.live.bowler] || blankBowler()];
}

export function playerStatsForMatch(state = {}) {
  const teams = state.teams || TEAMS;
  const players = Object.values(teams).flatMap((team) => team?.players || []);
  const result = {};
  for (const player of players) {
    result[player] = {
      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, highestScore: 0, dismissed: false, retired: false, dismissal: "", strikeRate: "0.00" },
      bowling: { balls: 0, overs: "0.0", runs: 0, wickets: 0, wides: 0, noBalls: 0, economy: "0.00" },
      fielding: { catches: 0, runOuts: 0, stumpings: 0 }
    };
  }
  for (const inn of state.innings || []) {
    const c = computeInnings(inn.deliveries || []);
    for (const [name, b] of Object.entries(c.batters)) {
      result[name] ||= { batting: { runs: 0, balls: 0, fours: 0, sixes: 0, highestScore: 0, dismissed: false, retired: false, dismissal: "", strikeRate: "0.00" }, bowling: { balls: 0, overs: "0.0", runs: 0, wickets: 0, wides: 0, noBalls: 0, economy: "0.00" }, fielding: { catches: 0, runOuts: 0, stumpings: 0 } };
      result[name].batting.runs += b.runs;
      result[name].batting.balls += b.balls;
      result[name].batting.fours += b.fours;
      result[name].batting.sixes += b.sixes;
      result[name].batting.highestScore = Math.max(result[name].batting.highestScore, b.runs);
      result[name].batting.dismissed ||= b.out;
      result[name].batting.retired ||= b.retired;
      if (b.dismissal) result[name].batting.dismissal = b.dismissal;
    }
    for (const [name, b] of Object.entries(c.bowlers)) {
      result[name] ||= { batting: { runs: 0, balls: 0, fours: 0, sixes: 0, highestScore: 0, dismissed: false, retired: false, dismissal: "", strikeRate: "0.00" }, bowling: { balls: 0, overs: "0.0", runs: 0, wickets: 0, wides: 0, noBalls: 0, economy: "0.00" }, fielding: { catches: 0, runOuts: 0, stumpings: 0 } };
      result[name].bowling.balls += b.balls;
      result[name].bowling.runs += b.runs;
      result[name].bowling.wickets += b.wickets;
      result[name].bowling.wides += b.wides;
      result[name].bowling.noBalls += b.noBalls;
    }
    for (const d of inn.deliveries || []) {
      const f = d.fielder;
      if (!f) continue;
      result[f] ||= { batting: { runs: 0, balls: 0, fours: 0, sixes: 0, highestScore: 0, dismissed: false, retired: false, dismissal: "", strikeRate: "0.00" }, bowling: { balls: 0, overs: "0.0", runs: 0, wickets: 0, wides: 0, noBalls: 0, economy: "0.00" }, fielding: { catches: 0, runOuts: 0, stumpings: 0 } };
      if (d.wicketType === "Caught") result[f].fielding.catches += 1;
      if (d.wicketType === "Run Out") result[f].fielding.runOuts += 1;
      if (d.wicketType === "Stumped") result[f].fielding.stumpings += 1;
    }
  }
  for (const stats of Object.values(result)) {
    stats.batting.strikeRate = stats.batting.balls ? ((stats.batting.runs / stats.batting.balls) * 100).toFixed(2) : "0.00";
    stats.bowling.overs = `${Math.floor(stats.bowling.balls / 6)}.${stats.bowling.balls % 6}`;
    stats.bowling.economy = stats.bowling.balls ? (stats.bowling.runs / (stats.bowling.balls / 6)).toFixed(2) : "0.00";
  }
  return result;
}

export function teamStats(state, teamCode, role = "batting", teams = TEAMS) {
  const players = teams[teamCode]?.players || [];
  const innings = state?.innings?.filter((inn) => role === "batting" ? inn.battingTeam === teamCode : inn.bowlingTeam === teamCode) || [];
  const merged = Object.fromEntries(players.map((p) => [p, { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, runsConceded: 0, legalBalls: 0, wides: 0, noBalls: 0, dismissed: false, retired: false }]));
  innings.forEach((inn) => {
    const c = computeInnings(inn.deliveries);
    players.forEach((p) => {
      if (role === "batting") {
        const b = c.batters[p];
        if (b) merged[p] = { ...merged[p], runs: merged[p].runs + b.runs, balls: merged[p].balls + b.balls, fours: merged[p].fours + b.fours, sixes: merged[p].sixes + b.sixes, dismissed: merged[p].dismissed || b.out, retired: merged[p].retired || b.retired };
      } else {
        const b = c.bowlers[p];
        if (b) merged[p] = { ...merged[p], wickets: merged[p].wickets + b.wickets, runsConceded: merged[p].runsConceded + b.runs, legalBalls: merged[p].legalBalls + b.balls, wides: merged[p].wides + b.wides, noBalls: merged[p].noBalls + b.noBalls };
      }
    });
  });
  return merged;
}

export function inningsAnalytics(innings, target = null) {
  const score = computeInnings(innings?.deliveries || []);
  const currentRR = score.legal ? score.runs / (score.legal / 6) : 0;
  const requiredRuns = target == null ? null : Math.max(0, target - score.runs);
  const ballsLeft = Math.max(0, MAX_OVERS * 6 - score.legal);
  const requiredRR = requiredRuns != null && ballsLeft ? requiredRuns / (ballsLeft / 6) : null;
  const futureRates = [4, 5, 6, 7, 8, 10, 12].map((rate) => ({ rate, projectedRuns: Math.round(score.runs + (ballsLeft / 6) * rate), chaseFinish: requiredRuns == null ? null : requiredRuns <= (ballsLeft / 6) * rate ? Math.ceil(requiredRuns / rate) : null }));
  return { score, currentRR, requiredRuns, ballsLeft, requiredRR, futureRates };
}
