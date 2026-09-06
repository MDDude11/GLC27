export const MAX_OVERS = 6;
export const MAX_WICKETS = 3;
export const STORAGE_KEY = "glt_drafts_2026_multipage_v7";
export const LEGACY_STORAGE_KEYS = [
  "glt_drafts_2026_multipage_v6",
  "glt_drafts_2026_multipage_v5",
  "glt_drafts_2026_multipage_v4",
  "glt_drafts_2026_multipage_v3",
  "glt_drafts_2026_multipage_v2"
];
export const SCORER_SESSION_KEY = "glt_drafts_scorer_unlocked_v7";
export const SCORER_PASSWORD = import.meta.env?.VITE_SCORER_PASSWORD || "DRAFTS27";

export const THEME_KEY = "glt_drafts_theme";
export const SETTINGS_KEY = "glt_drafts_settings_v2";

export const DEFAULT_SETTINGS = {
  reduceMotion: false,
  soundEffects: true,
  clickVibration: true,
  compactMode: false,
  largeText: false
};

export function loadSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  const mobileReducedMotion = window.matchMedia?.("(max-width: 700px), (hover: none), (pointer: coarse)").matches ?? false;
  const defaults = { ...DEFAULT_SETTINGS, reduceMotion: mobileReducedMotion };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return { ...defaults, ...(parsed || {}) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("glt-settings-updated", { detail: settings }));
}

export function applySettingsToDocument(settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.reduceMotion = settings.reduceMotion ? "1" : "0";
  root.dataset.compact = settings.compactMode ? "1" : "0";
  root.dataset.largeText = settings.largeText ? "1" : "0";
}

export const TEAMS = {
  AIY: { code: "AIY", name: "AIY", accent: "#ff6b5f", paper: "#ffd9c8", players: ["Arsh", "Ishaansh", "Yug"] },
  NTV: { code: "NTV", name: "NTV", accent: "#5fa8ff", paper: "#d8ecff", players: ["Nishil", "Tanmay", "Vivaan"] },
  ANA: { code: "ANA", name: "ANA", accent: "#f0a56b", paper: "#ffe2bd", players: ["Arnav", "Naisha", "Agastya/Arsh"] },
  YAM: { code: "YAM", name: "YAM", accent: "#bb8cff", paper: "#e8d9ff", players: ["Yash", "Ayaansh", "Manan"] }
};

export const MATCHES = {
  D1: { id: "D1", label: "DEMO 01", date: "14 MAY 2026", time: "19:00", t1: "AIY", t2: "NTV" },
  D2: { id: "D2", label: "DEMO 02", date: "15 MAY 2026", time: "16:30", t1: "ANA", t2: "YAM" }
};

export const matchPath = (id) => `./match.html?match=${encodeURIComponent(id)}`;
export const scorerPath = (id) => `./scorer.html?match=${encodeURIComponent(id)}`;

export function emptyLive() {
  return { striker: "", nonStriker: "", bowler: "", previousBowler: "", freeHit: false };
}

export function emptyMatch() {
  return { status: "upcoming", innings: [], live: emptyLive(), result: null, toss: null };
}

export function freshStore() {
  return { matches: Object.fromEntries(Object.keys(MATCHES).map((id) => [id, emptyMatch()])) };
}
