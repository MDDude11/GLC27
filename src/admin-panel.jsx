import { useMemo, useState } from "react";
import { ComicTitle, Modal } from "./components.jsx";
import { ADMIN_ROSTER, ADMIN_PASSWORD, createEmptyInternalMatch, createInternalMatchId } from "./admin.js";
import { createInternalMatch, deleteInternalMatch, listInternalMatches } from "./store.js";
import { writeFirebaseNotification } from "./firebase.js";


const accents = ["#ff675d", "#76caff", "#efff3f", "#c39aff", "#ffb160", "#74d79a"];
const today = new Date();
const defaultDate = today.toISOString().slice(0, 10);

export default function AdminPanel() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [matches, setMatches] = useState({});
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [status, setStatus] = useState("");
  const [pushOpen, setPushOpen] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    label: "Internal Test Match",
    date: defaultDate,
    time: "19:00",
    venue: "",
    teamAName: "TEAM A",
    teamBName: "TEAM B",
    teamAPlayers: ["", "", ""],
    teamBPlayers: ["", "", ""]
  }));

  const rosterOptions = useMemo(() => ADMIN_ROSTER, []);
  const loadMatches = async () => {
    const all = await listInternalMatches();
    setMatches(all);
  };

  const unlock = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setUnlocked(true);
      setError("");
      void loadMatches();
    } else setError("Incorrect admin password.");
  };

  const exit = () => {
    setUnlocked(false);
    setPassword("");
    setStatus("Admin mode exited. Password required to re-enter.");
  };

  const setPlayer = (side, index, value) => {
    setForm((current) => ({ ...current, [`team${side}Players`]: current[`team${side}Players`].map((p, i) => i === index ? value : p) }));
  };

  const create = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!navigator.onLine) return setStatus("No internet connection. Reconnect before creating an internal match.");
    const a = form.teamAPlayers.filter(Boolean);
    const b = form.teamBPlayers.filter(Boolean);
    if (a.length !== 3 || b.length !== 3) return setStatus("Each team must have exactly 3 players.");
    if (new Set([...a, ...b]).size < 6) return setStatus("Each player must be selected only once in this match.");
    setBusy(true); setStatus("");
    try {
      const id = createInternalMatchId(new Set(Object.keys(matches || {})));
      const teamA = { code: "A", name: form.teamAName.trim() || "TEAM A", accent: accents[0], paper: "#ffd9c8", players: a };
      const teamB = { code: "B", name: form.teamBName.trim() || "TEAM B", accent: accents[1], paper: "#d8ecff", players: b };
      const match = createEmptyInternalMatch({ id, label: form.label.trim() || id, date: form.date, time: form.time, venue: form.venue.trim(), teamA, teamB });
      await createInternalMatch(match);
      await loadMatches();
      setStatus(`Created ${match.label}. Saved to Firebase matches/${id}.`);
    } catch (error) {
      console.error(error);
      setStatus("Match creation failed. Check Firebase connectivity and try again.");
    } finally { setBusy(false); }
  };

  const remove = async (match) => {
    if (!match?.id || busy || deletingId) return;
    const confirmed = window.confirm(
      `Delete ${match.label}? This permanently removes the internal Firebase match and its saved result.`
    );
    if (!confirmed) return;

    setDeletingId(match.id);
    setStatus("");
    try {
      await deleteInternalMatch(match.id);
      await loadMatches();
      setStatus(`Deleted ${match.label}.`);
    } catch (error) {
      console.error(error);
      setStatus("Match deletion failed. Check Firebase connectivity and try again.");
    } finally {
      setDeletingId("");
    }
  };

  const sendPush = async (event) => {
    event.preventDefault();
    if (pushBusy) return;
    if (!pushTitle.trim() || !pushBody.trim()) return setStatus("Enter both a notification title and message.");
    setPushBusy(true);
    try {
      await writeFirebaseNotification({ title: pushTitle.trim(), body: pushBody.trim(), kind: "admin" });
      setPushTitle("");
      setPushBody("");
      setPushOpen(false);
      setStatus("Notification published for subscribed GLC27 devices.");
    } catch (error) {
      console.error(error);
      setStatus("Notification send failed. Check Firebase connectivity.");
    } finally { setPushBusy(false); }
  };

  if (!unlocked) return <section className="admin-gate comic-panel paper-panel">
    <span className="panel-kicker">RESTRICTED / INTERNAL TEST BUILD</span>
    <ComicTitle as="h2">Admin <i>mode.</i></ComicTitle>
    <p>Separate internal test-match control. Custom match IDs are stored in the shared matches feed.</p>
    <form className="admin-password-form" onSubmit={unlock}>
      <label>Admin password<input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Enter secret password" autoComplete="off" /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="comic-button primary" type="submit">Unlock admin mode <span>→</span></button>
    </form>
  </section>;

  return <section className="admin-mode comic-panel dark-panel">
    <div className="panel-heading"><div><span className="panel-kicker">INTERNAL ADMIN / MATCHES STORE</span><ComicTitle as="h2">Build a <i>match.</i></ComicTitle></div><button type="button" className="modal-close-button close-button offline-safe" onClick={exit}>Exit admin ×</button></div>
    <div className="admin-inner">
      <form className="admin-match-form" onSubmit={create}>
        <div className="admin-form-grid">
          <label>Match label<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Start time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          <label>Venue / location<input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Optional" /></label>
        </div>
        {["A", "B"].map((side) => <fieldset className="admin-team-fieldset" key={side}><legend>{side === "A" ? "TEAM A" : "TEAM B"}</legend><label>Team name<input value={form[`team${side}Name`]} onChange={(e) => setForm({ ...form, [`team${side}Name`]: e.target.value })} /></label><div className="admin-player-grid">{[0,1,2].map((index) => <label key={`${side}-${index}`}>Player {index + 1}<select value={form[`team${side}Players`][index]} onChange={(e) => setPlayer(side, index, e.target.value)}><option value="">Select player</option>{rosterOptions.map((p) => <option key={`${side}-${index}-${p}`} value={p}>{p}</option>)}</select></label>)}</div></fieldset>)}
        <div className="admin-form-actions"><button className="comic-button primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Create match ↗"}</button><button type="button" className="back-button offline-safe" onClick={() => { setForm({ ...form, teamAPlayers: ["", "", ""], teamBPlayers: ["", "", ""] }); setStatus(""); }}>Clear players</button></div>
      </form>
      {status && <div className="admin-status" role="status">{status}</div>}
      <div className="admin-match-list"><div className="admin-list-heading"><span className="panel-kicker">CREATED INTERNAL MATCHES</span><button type="button" className="small-control offline-safe" onClick={loadMatches}>Refresh ↻</button></div>{Object.values(matches).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((match) => <article className="admin-match-item" key={match.id}><div><b>{match.label}</b><span>{match.date} · {match.time}{match.venue ? ` · ${match.venue}` : ""}</span><small>{match.teams?.A?.name} · {match.teams?.A?.players?.join(" / ")} <br /> {match.teams?.B?.name} · {match.teams?.B?.players?.join(" / ")}</small></div><div className="admin-match-actions"><span className="admin-created-note">Created. Open it later from Home → Matches.</span><button type="button" className="comic-button delete-card-button" onClick={() => remove(match)} disabled={busy || !!deletingId}>{deletingId === match.id ? "Deleting…" : "Delete ×"}</button></div></article>)}{!Object.keys(matches).length && <div className="empty-state">No internal matches yet.</div>}</div>
      <div className="admin-bottom-tools"><span className="admin-created-note">DEVICE MESSAGING</span><button type="button" className="small-control offline-safe" onClick={() => setPushOpen(true)}>Push Notifications</button></div>
      {pushOpen && <Modal onClose={() => setPushOpen(false)} className="admin-push-modal paper-panel" ariaLabel="Push notifications"><div className="modal-heading"><div><span className="panel-kicker">ADMIN / DEVICE MESSAGING</span><ComicTitle as="h2">Push <i>notifications.</i></ComicTitle></div><button type="button" className="modal-close-button close-button" onClick={() => setPushOpen(false)}>Close ×</button></div><form className="admin-push-form" onSubmit={sendPush}><label>Notification title<input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} maxLength={120} placeholder="GLC27 update" /></label><label>Message<textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} maxLength={500} rows={5} placeholder="Your message to subscribed devices" /></label><small className="settings-footnote">Broadcasts to devices that have notifications enabled in the installed Android PWA.</small><div className="modal-actions"><button type="button" className="back-button viewer-family" onClick={() => setPushOpen(false)}>Cancel</button><button className="comic-button primary" type="submit" disabled={pushBusy}>{pushBusy ? "Sending…" : "Send notification ↗"}</button></div></form></Modal>}
    </div>
  </section>;
}
