import { useEffect, useMemo, useRef, useState } from "react";
import { TEAMS, loadSettings, applySettingsToDocument, THEME_KEY, sitePath } from "./data.js";
import { watchFirebaseConnection } from "./firebase.js";
import { flushPendingWrites } from "./store.js";
import { computeInnings, fallOfWickets, inningsAnalytics, teamStats } from "./engine.js";

export function HalftoneField() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: -1000, y: -1000, active: false });
  const targetRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let gap = 28;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      gap = Math.max(22, Math.min(34, Math.round(width / 45)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    const getRGB = () => getComputedStyle(document.documentElement).getPropertyValue("--halftone-rgb").trim() || "245,238,223";

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      if (document.documentElement.dataset.reduceMotion === "1") return;
      const rgb = getRGB();
      const current = pointerRef.current;
      const radius = gap * 4.2;
      const base = 1.15;
      for (let y = gap * .55; y < height + gap; y += gap) {
        for (let x = gap * .55; x < width + gap; x += gap) {
          let dotX = x;
          let dotY = y;
          let dotR = base;
          if (current.active && fine.matches) {
            const dx = current.x - x;
            const dy = current.y - y;
            const dist = Math.hypot(dx, dy);
            const influence = Math.max(0, 1 - dist / radius);
            if (influence > 0) {
              const eased = influence * influence * (3 - 2 * influence);
              const pull = gap * .28 * eased;
              dotX += dx * (pull / Math.max(dist, 1));
              dotY += dy * (pull / Math.max(dist, 1));
              dotR += 5.4 * eased;
            }
          }
          ctx.beginPath();
          ctx.fillStyle = `rgba(${rgb},.18)`;
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      runningRef.current = false;
    };

    const tick = () => {
      const p = pointerRef.current;
      const t = targetRef.current;
      p.x += (t.x - p.x) * .18;
      p.y += (t.y - p.y) * .18;
      paint();
      if (p.active) rafRef.current = requestAnimationFrame(tick);
      else stop();
    };

    const start = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    };

    const move = (event) => {
      if (!fine.matches) return;
      targetRef.current = { x: event.clientX, y: event.clientY };
      pointerRef.current.active = true;
      start();
    };
    const leave = () => {
      pointerRef.current.active = false;
      paint();
      stop();
    };
    const themeObserver = new MutationObserver(paint);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "data-reduce-motion"] });

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      stop();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas ref={canvasRef} className="halftone-field" aria-hidden="true" />;
}

const POW_WORDS = ["POW!", "BAM!", "ZING!", "WHACK!", "BONK!", "SMACK!"];
const POW_SELECTOR = [
  ".comic-button", ".run-key", ".tool-button", ".central-scorecard-button",
  ".expand-button", ".back-button", ".undo-button", ".player-pick",
  ".dismissed-option", ".modal-close-button", ".analysis-tabs button",
  ".text-reset", ".light-mode-button", ".dark-mode-button", ".small-control",
].join(",");
const SPARK_SELECTOR = [".nav-link", ".team-badge", ".match-card", ".programme-half"].join(",");

function sparkSvg() {
  return `<svg viewBox="0 0 100 100"><path d="M50 2 L61 38 L96 30 L67 54 L88 88 L50 66 L12 88 L33 54 L4 30 L39 38 Z"/></svg>`;
}

function usePressFX() {
  useEffect(() => {
    let layer = document.querySelector(".pow-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "pow-layer";
      document.body.appendChild(layer);
    }

    const settingsNow = () => loadSettings();
    const pointerStarts = new Map();
    const cancelledPointers = new Set();

    const spawn = (x, y, target) => {
      if (settingsNow().reduceMotion) return;
      const isPow = target.closest(POW_SELECTOR);
      const isSpark = !isPow && target.closest(SPARK_SELECTOR);
      if (!isPow && !isSpark) return;

      const el = document.createElement("div");
      const rot = `${(Math.random() * 22 - 11).toFixed(1)}deg`;

      if (isPow) {
        el.className = "pow-burst";
        el.textContent = POW_WORDS[Math.floor(Math.random() * POW_WORDS.length)];
        el.style.setProperty("--pow-rot", rot);
        el.style.setProperty("--pow-size", `${16 + Math.round(Math.random() * 8)}px`);
      } else {
        el.className = "pow-spark";
        el.innerHTML = sparkSvg();
        el.style.setProperty("--pow-rot", rot);
      }

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      layer.appendChild(el);
      el.addEventListener("animationend", () => el.remove(), { once: true });
      window.setTimeout(() => el.remove(), 900);
    };

    const onPointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.isPrimary === false) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button:disabled")) return;

      pointerStarts.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        target
      });
      cancelledPointers.delete(event.pointerId);

      const s = settingsNow();
      if (
        s.clickVibration &&
        navigator.vibrate &&
        (event.pointerType === "touch" || !event.pointerType)
      ) {
        const isInteractive = target.closest("button, a, select, .run-key, .player-pick, .dismissed-option");
        if (isInteractive) navigator.vibrate(12);
      }
    };

    const onPointerMove = (event) => {
      const start = pointerStarts.get(event.pointerId);
      if (!start || cancelledPointers.has(event.pointerId)) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 16) {
        cancelledPointers.add(event.pointerId);
      }
    };

    const onPointerUp = (event) => {
      const start = pointerStarts.get(event.pointerId);
      pointerStarts.delete(event.pointerId);

      if (event.isPrimary === false || !start || cancelledPointers.has(event.pointerId)) {
        cancelledPointers.delete(event.pointerId);
        return;
      }

      cancelledPointers.delete(event.pointerId);
      // Only a tap gets a POW/spark. A finger that moved to scroll is ignored.
      spawn(event.clientX, event.clientY, start.target);
    };

    const onPointerCancel = (event) => {
      pointerStarts.delete(event.pointerId);
      cancelledPointers.delete(event.pointerId);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", onPointerCancel, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);
}
function useComicNavigation() {
  useEffect(() => {
    const supportsVT = typeof document.startViewTransition === "function";
    const reduceMotion = typeof document !== "undefined" && document.documentElement.dataset.reduceMotion === "1";
    if (!supportsVT || reduceMotion) return undefined;
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (document.documentElement.dataset.reduceMotion === "1") return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.target === "_blank") return;
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      let url;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || url.pathname.endsWith(".html")) return;
      event.preventDefault();
      document.startViewTransition(() => {
        window.location.href = href;
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

function useConnectivityStatus() {
  useEffect(() => {
    let active = true;
    let firebaseUnsubscribe = () => {};
    const setStatus = (connected) => {
      if (!active) return;
      document.documentElement.dataset.offline = connected ? "0" : "1";
    };

    const onBrowserOnline = () => setStatus(true);
    const onBrowserOffline = () => setStatus(false);

    setStatus(navigator.onLine !== false);
    window.addEventListener("online", onBrowserOnline);
    window.addEventListener("offline", onBrowserOffline);

    void watchFirebaseConnection((connected) => {
      setStatus(navigator.onLine !== false && connected);
      if (connected) void flushPendingWrites();
    }).then((unsubscribe) => {
      if (!active) unsubscribe?.();
      else if (typeof unsubscribe === "function") firebaseUnsubscribe = unsubscribe;
    });

    return () => {
      active = false;
      firebaseUnsubscribe?.();
      window.removeEventListener("online", onBrowserOnline);
      window.removeEventListener("offline", onBrowserOffline);
      delete document.documentElement.dataset.offline;
    };
  }, []);
}

export function SiteFrame({ children, active = "" }) {
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(sitePath("/sw.js"), { scope: sitePath("/") }).catch((error) => {
        console.warn("PWA service worker registration failed.", error);
      });
    }
    const saved = localStorage.getItem(THEME_KEY);
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
    applySettingsToDocument(loadSettings());
    const onSettings = (e) => applySettingsToDocument(e.detail || loadSettings());
    window.addEventListener("glt-settings-updated", onSettings);
    window.addEventListener("storage", onSettings);
    return () => {
      window.removeEventListener("glt-settings-updated", onSettings);
      window.removeEventListener("storage", onSettings);
    };
  }, []);
  usePressFX();
  useComicNavigation();
  useConnectivityStatus();
  return <div className="site-shell">
    <HalftoneField />
    <div className="network-status" role="status" aria-live="polite">No internet connection — reconnect to continue.</div>
    <div className="ambient ambient-a" /><div className="ambient ambient-b" /><div className="ambient ambient-c" /><div className="grain" />
    <header className="topbar">
      <a className="brand-lockup" href={sitePath("/")} aria-label="Gala Luxuria Cup 2027 home"><span className="brand-mark">GLC27</span><span className="brand-copy"><b>Gala Luxuria Cup</b><small>2027</small></span></a>
      <nav aria-label="Primary navigation">
        <a className={`nav-link nav-home ${active === "home" ? "active" : ""}`} href={sitePath("/")}>Home</a>
        <a className={`nav-link nav-settings ${active === "settings" ? "active" : ""}`} href={sitePath("/settings")}>Settings</a>
        <a className={`nav-link nav-about ${active === "about" ? "active" : ""}`} href={sitePath("/about")}>About</a>
      </nav>
      <div className="live-indicator">THE *DRAFTS* / GLC27</div>
    </header>
    {children}
    <footer className="site-footer"><span>Gala Luxuria Cup 2027</span><span>The <i>DRAFTS</i> / GLC27</span></footer>
  </div>;
}

export function ComicTitle({ as: Tag = "h1", children, className = "" }) {
  return <Tag className={`comic-title ${className}`}>{children}</Tag>;
}

export function WicketCount({ wickets, deliveries, className = "" }) {
  const falls = useMemo(() => fallOfWickets(deliveries || []), [deliveries]);
  const [open, setOpen] = useState(false);
  if (!falls.length) return <span className={className}>{wickets}</span>;
  const list = falls.slice().reverse();
  return <span
    className={`wicket-count-tip ${className}`}
    tabIndex={0}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)}
    onBlur={() => setOpen(false)}
  >
    {wickets}
    {open && <span className="wicket-tip-pop" role="tooltip">
      <span className="wicket-tip-title">FALL OF WICKETS</span>
      {list.map((f, i) => <span className="wicket-tip-row" key={`fow-${i}-${f.dismissed}`}>
        <b>{f.dismissed}</b>
        <span>{f.wicketType}{f.bowler ? ` · b. ${f.bowler}` : ""}{f.fielder ? ` (${f.fielder})` : ""}</span>
      </span>)}
    </span>}
  </span>;
}

export function TeamBadge({ code, large = false, teams = TEAMS }) {
  const team = teams?.[code] || TEAMS[code];
  if (!team) return null;
  return <div className={`team-badge ${large ? "large" : ""}`} style={{ "--team": team.accent, "--team-paper": team.paper }} aria-label={team.name}><span>{team.code}</span></div>;
}

export function ScoreMini({ state, fixture }) {
  const scores = state.innings.map((inn) => computeInnings(inn.deliveries));
  if (!scores.length) return <span className="score-empty">NO SCORE RECORDED</span>;
  return <>{scores.map((score, index) => <span key={`${fixture.id}-score-${index}`}>{fixture[index === 0 ? "t1" : "t2"]} <b>{score.runs}/{score.wickets}</b> <small>({score.overs}.{score.balls})</small></span>)}</>;
}

function resultClass(d) {
  if (d.retired) return "is-retired";
  if (d.wicket) return "is-wicket";
  if (d.noBall) return "is-no-ball";
  if (d.wide) return "is-wide";
  if (d.runs === 4) return "is-four";
  if (d.runs === 6) return "is-six";
  if (d.runs === 0) return "is-dot";
  return "is-run";
}

export function Commentary({ deliveries, limit = null }) {
  if (!deliveries?.length) return <div className="empty-state">No deliveries yet.</div>;
  const reversed = deliveries.slice().reverse();
  const shown = limit ? reversed.slice(0, limit) : reversed;
  return <div className="commentary-list">
    {limit && deliveries.length > limit && <div className="commentary-truncated-note">Showing last {limit} of {deliveries.length} — expand to see the full over-by-over record.</div>}
    {shown.map((d, index) => <div className={`commentary-row ${resultClass(d)}`} key={`commentary-${index}-${d.striker || "batter"}-${d.bowler || "bowler"}-${d.wicketType || d.retirementType || "run"}`}>
      <span className="ball-mark">{d.retired ? "RET" : d.wicket ? "W" : d.noBall ? "NB" : d.wide ? "WD" : d.runs}</span>
      <div><b>{d.striker || "—"}</b><span>{d.retired ? `${d.retirementType || "Retired"} — ${d.dismissed || ""}` : d.wicket ? `${d.wicketType || "Wicket"} — ${d.dismissed || ""}` : d.noBall ? "No ball" : d.wide ? "Wide" : `${d.runs} run${d.runs === 1 ? "" : "s"}`}</span></div>
      <small>{d.bowler || "—"}</small>
    </div>)}
  </div>;
}
Commentary.defaultLimit = 6;

export function Scorecard({ innings }) {
  return <div className="scorecard-list">
    {innings.map((inn, inningsIndex) => {
      const c = computeInnings(inn.deliveries);
      return <div className="scorecard-innings" key={`scorecard-${inn.battingTeam}-${inningsIndex}`}>
        <div className="scorecard-title"><b>{inn.battingTeam}</b><strong>{c.runs}/{c.wickets}</strong><span>{c.overs}.{c.balls} ov</span></div>
        <div className="scorecard-table">
          <div className="table-head"><span>Batter</span><span>R</span><span>B</span><span>4s</span><span>6s</span></div>
          {Object.entries(c.batters).map(([name, p]) => <div className="table-row" key={`scorecard-${inn.battingTeam}-bat-${name}`}><span>{name}{p.out || p.retired ? <small> · {p.dismissal}</small> : ""}</span><b>{p.runs}</b><span>{p.balls}</span><span>{p.fours}</span><span>{p.sixes}</span></div>)}
          <div className="table-head bowling-head"><span>Bowler</span><span>OV</span><span>R</span><span>W</span><span>ER</span></div>
          {Object.entries(c.bowlers).map(([name, p]) => <div className="table-row" key={`scorecard-${inn.battingTeam}-bowl-${name}`}><span>{name}</span><span>{Math.floor(p.balls / 6)}.{p.balls % 6}</span><b>{p.runs}</b><span>{p.wickets}</span><span>{p.balls ? (p.runs / (p.balls / 6)).toFixed(1) : "—"}</span></div>)}
        </div>
      </div>;
    })}
  </div>;
}

export function PlayerStats({ state, teamCodes, teams = TEAMS, mode = "viewer" }) {
  const groups = useMemo(() => teamCodes.map((code) => ({ code, batting: teamStats(state, code, "batting", teams), bowling: teamStats(state, code, "bowling", teams) })), [state, teamCodes, teams]);
  return <section className={`player-stats-section ${mode === "scorer" ? "scorer-stats-section" : "viewer-stats-section"}`}>
    <div className="panel-heading"><div><span className="panel-kicker">{mode === "scorer" ? "PLAYER CONTROL" : "PLAYER INDEX"}</span><ComicTitle as="h2">All player figures</ComicTitle></div><span className="format-stamp">LIVE</span></div>
    <div className="player-stats-groups">
      {groups.map(({ code, batting, bowling }) => <article className="player-stats-group" key={`stats-group-${code}`}>
        <header><TeamBadge code={code} teams={teams} /><b>{teams?.[code]?.name || code}</b></header>
        <div className="player-stats-grid">
          {(teams?.[code]?.players || TEAMS[code]?.players || []).map((name) => {
            const b = batting[name], bo = bowling[name];
            const sr = b.balls ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00";
            const econ = bo.legalBalls ? (bo.runsConceded / (bo.legalBalls / 6)).toFixed(2) : "0.00";
            const overs = `${Math.floor(bo.legalBalls / 6)}.${bo.legalBalls % 6}`;
            const role = b.dismissed ? (b.retired ? "RETIRED" : "OUT") : state.live.striker === name ? "STRIKER" : state.live.nonStriker === name ? "NON-STRIKER" : state.live.bowler === name ? "BOWLER" : "ACTIVE";
            return <div className="player-stat-card" key={`player-stat-${code}-${name}`}><div className="player-stat-name"><b>{name}</b><span>{role}</span></div><div className="stat-cluster"><div><small>BAT</small><strong>{b.runs}</strong><span>{b.balls} B · SR {sr}</span></div><div><small>BOWL</small><strong>{bo.wickets}</strong><span>{overs} OV · {bo.runsConceded} R · ECON {econ}</span></div></div>{mode === "scorer" && <div className="scorer-extra">{b.fours} × 4 · {b.sixes} × 6 · {bo.wides} WD · {bo.noBalls} NB</div>}</div>;
          })}
        </div>
      </article>)}
    </div>
  </section>;
}

export function Modal({ children, onClose, origin = null, className = "", ariaLabel = "Dialog", morphName = "" }) {
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(closeTimerRef.current);
    };
  });
  const requestClose = () => {
    if (closing) return;
    if (document.documentElement.dataset.reduceMotion === "1") { onClose?.(); return; }
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => onClose?.(), 110);
  };
  const style = origin ? { "--origin-x": `${origin.x}px`, "--origin-y": `${origin.y}px` } : undefined;
  const shellStyle = style;
  return <div className={`modal-backdrop ${closing ? "is-closing" : ""}`} onClick={requestClose} style={style} role="presentation">
    <div className={`modal-shell ${className} ${closing ? "is-closing" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={ariaLabel} style={shellStyle}>{children}</div>
  </div>;
}

/** Opens a modal by morphing the clicked trigger element into the modal shell
 * (matching view-transition-name on both), so the card visually zooms into
 * becoming the popup instead of just appearing. Falls back to a plain open
 * on browsers without View Transitions or when the user prefers less motion. */
export function morphOpen(event, vtName, openFn) {
  // Open immediately. The old implementation combined the View Transitions API
  // with the newly mounted modal, which could leave the trigger painted above the
  // expanded card while the transition settled. The modal now owns its own short
  // CSS entry animation, with reduced-motion falling back to an instant open.
  void event;
  void vtName;
  openFn();
}

function linePath(points, width, height, padding = 14) {
  if (!points.length) return "";
  const max = Math.max(1, ...points.map((p) => p.y));
  const min = Math.min(0, ...points.map((p) => p.y));
  const xStep = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);
  return points.map((p, i) => {
    const x = padding + i * xStep;
    const y = height - padding - ((p.y - min) / Math.max(1, max - min)) * (height - padding * 2);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function MiniLine({ points, label, accent = "var(--blue)" }) {
  const path = linePath(points, 520, 220, 20);
  return <div className="analytics-chart"><div className="chart-caption"><span>{label}</span><i /></div><svg viewBox="0 0 520 220" preserveAspectRatio="none" aria-label={label}><path d="M20 180 H500" className="chart-axis" /><path d={path} className="chart-line" style={{ stroke: accent }} /><circle cx="500" cy="180" r="0" /></svg></div>;
}

function Manhattan({ overRuns }) {
  const max = Math.max(1, ...overRuns);
  return <div className="analytics-chart manhattan-chart"><div className="chart-caption"><span>MANHATTAN</span><i /></div><div className="bar-row">{overRuns.map((v, i) => <div className="chart-bar-wrap" key={`over-bar-${i}`}><div className="chart-bar" style={{ height: `${Math.max(5, (v / max) * 100)}%` }}><b>{v}</b></div><small>{i + 1}</small></div>)}</div></div>;
}

export function DetailedStatsModal({ innings = [], onClose, origin = null, morphName = "" }) {
  const [analysisIndex, setAnalysisIndex] = useState(Math.max(0, innings.length - 1));
  const inn = innings[analysisIndex];
  const first = innings[0] ? computeInnings(innings[0].deliveries) : null;
  const target = innings.length > 1 && first ? first.runs + 1 : null;
  const analytics = inn ? inningsAnalytics(inn, target) : null;
  const c = analytics?.score;
  const rrPoints = c?.cumulative?.map((p) => ({ y: p.runs })) || [];
  const runRatePoints = c?.overRuns?.map((runs, i) => ({ y: runs / 6, label: i + 1 })) || [];
  return <Modal origin={origin} onClose={onClose} className="detailed-stats-modal" ariaLabel="Detailed match statistics" morphName={morphName}>
    <div className="modal-heading"><div><span className="panel-kicker">ANALYTICAL RECORD</span><ComicTitle as="h2">Detailed stats</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div>
    {innings.length > 1 && <div className="analysis-tabs">{innings.map((x, i) => <button key={`analysis-tab-${i}`} className={analysisIndex === i ? "active" : ""} onClick={() => setAnalysisIndex(i)}>{x.battingTeam} INNINGS</button>)}</div>}
    {analytics && <>
      <div className="headline-metrics"><article><span>CRR</span><strong>{analytics.currentRR.toFixed(2)}</strong><small>current run rate</small></article><article><span>RRR</span><strong>{analytics.requiredRR == null ? "—" : analytics.requiredRR.toFixed(2)}</strong><small>{analytics.requiredRuns == null ? "not a chase" : `${analytics.requiredRuns} runs required`}</small></article><article><span>BALLS LEFT</span><strong>{analytics.ballsLeft}</strong><small>legal deliveries</small></article></div>
      <section className="analytics-grid-full"><MiniLine points={rrPoints} label="WORM / CUMULATIVE RUNS" accent="var(--blue)" /><Manhattan overRuns={c.overRuns || []} /><MiniLine points={runRatePoints} label="RUN RATE BY OVER" accent="var(--purple)" /></section>
      <section className="future-rr-panel"><div className="section-title"><div><span className="panel-kicker">SCENARIO ANALYSIS</span><h3>Analytical future RR</h3></div><span className="eyebrow">PROJECTION</span></div><div className="future-rr-grid">{analytics.futureRates.map((item) => <article key={`future-rr-${item.rate}`}><strong>{item.rate.toFixed(0)}</strong><span>RPO</span><b>{item.projectedRuns}</b><small>{item.chaseFinish == null ? (target == null ? "Projected final" : "Target not reached") : `Target in ~${item.chaseFinish} balls`}</small></article>)}</div></section>
    </>}
  </Modal>;
}

export function ScorecardModal({ innings, onClose, origin = null, morphName = "" }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOrigin, setDetailsOrigin] = useState(null);
  return <Modal origin={origin} onClose={onClose} className="scorecard-modal" ariaLabel="Full scorecard" morphName={morphName}>
    <div className="modal-heading"><div><span className="panel-kicker">OFFICIAL RECORD</span><ComicTitle as="h2">Full scorecard</ComicTitle></div><button className="modal-close-button close-button" onClick={onClose}>Close ×</button></div>
    <Scorecard innings={innings} />
    <button className="comic-button stats-family modal-details-button" onClick={(e) => morphOpen(e, "detailed-stats-morph", () => { setDetailsOrigin({ x: e.clientX, y: e.clientY }); setDetailsOpen(true); })}>Detailed stats ↗</button>
    {detailsOpen && <DetailedStatsModal innings={innings} origin={detailsOrigin} onClose={() => setDetailsOpen(false)} morphName="detailed-stats-morph" />}
  </Modal>;
}

export function HandDrawnBat({ className = "" }) {
  return <svg className={`hand-bat ${className}`} viewBox="0 0 260 620" role="img" aria-label="Hand-illustrated cricket bat"><path className="sketch-shadow" d="M111 10 C104 24 101 43 105 68 L114 126 C94 151 76 192 69 251 C60 330 66 434 85 541 C89 566 102 586 129 592 C158 598 181 580 186 553 C206 442 210 325 194 252 C187 207 166 160 145 129 L153 67 C156 41 149 20 139 10 Z"/><path className="sketch-bat" d="M111 9 C104 27 101 47 106 72 L114 126 C94 151 77 192 69 251 C60 330 66 434 85 541 C89 566 102 586 129 592 C158 598 181 580 186 553 C206 442 210 325 194 252 C187 207 166 160 145 129 L153 67 C156 41 149 25 139 9 Z"/><path className="bat-edge" d="M115 127 C94 166 79 210 75 266 C69 360 76 470 91 535 C95 552 106 568 126 573"/><path className="bat-grain" d="M105 202 C132 218 151 225 181 216 M91 273 C123 289 154 292 191 278 M88 352 C122 366 157 368 194 352 M89 430 C122 444 157 444 190 429"/><path className="bat-grip" d="M111 13 C107 28 106 45 109 63 L116 118 L144 119 L150 63 C153 42 149 25 139 12 Z"/><path className="grip-line" d="M109 31 L148 39 M108 47 L147 55 M110 63 L145 70 M112 80 L143 87 M114 97 L141 103"/><path className="bat-crease" d="M130 140 L129 550"/></svg>;
}

export function HandDrawnBall({ className = "" }) {
  return <svg className={`hand-ball ${className}`} viewBox="0 0 180 180" role="img" aria-label="Hand-illustrated cricket ball"><circle className="ball-shadow" cx="94" cy="98" r="69"/><path className="ball-body" d="M89 26 C126 26 154 50 160 84 C167 120 143 151 108 158 C70 165 34 145 25 112 C16 77 36 42 64 31 C72 28 81 26 89 26 Z"/><path className="ball-seam" d="M43 47 C63 64 71 87 68 109 C65 132 75 148 96 158"/><path className="ball-seam" d="M122 34 C104 55 99 78 105 101 C112 128 124 143 142 149"/><path className="ball-stitch" d="M49 53 L55 48 M57 61 L63 57 M63 70 L69 67 M68 80 L74 78 M69 91 L75 91 M68 103 L74 104 M67 114 L73 117 M70 126 L76 130 M77 137 L82 142 M86 145 L90 151"/></svg>;
}
