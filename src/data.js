export const MAX_OVERS = 6;
export const MAX_WICKETS = 3;
export const SUPER_OVER_MAX_OVERS = 1;
export const SUPER_OVER_MAX_WICKETS = 2;
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

export const SITE_BASE = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");

export const sitePath = (path = "/") => {
  const clean = String(path).startsWith("/") ? String(path) : `/${path}`;
  return `${SITE_BASE}${clean}` || "/";
};
export const SETTINGS_KEY = "glt_drafts_settings_v4";
export const LEGACY_SETTINGS_KEYS = ["glt_drafts_settings_v3", "glt_drafts_settings_v2"];
export const SOUND_SETTINGS_VERSION_KEY = "glt_drafts_sound_settings_v4";
export const TEXT_SIZE_SETTINGS_VERSION_KEY = "glt_drafts_text_size_settings_v1";

export const DEFAULT_SETTINGS = {
  themeColor: "yellow",
  reduceMotion: false,
  soundEffects: false,
  clickVibration: true,
  compactMode: false,
  largeText: false,
  textSize: 1
};

export function loadSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };

  try {
    const currentRaw = localStorage.getItem(SETTINGS_KEY);

    if (currentRaw) {
      const parsed = JSON.parse(currentRaw) || {};
      const needsSoundDefaultMigration = localStorage.getItem(SOUND_SETTINGS_VERSION_KEY) !== "4";
      const needsTextSizeMigration = localStorage.getItem(TEXT_SIZE_SETTINGS_VERSION_KEY) !== "1";
      const merged = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        ...(needsSoundDefaultMigration ? { soundEffects: false } : {}),
        ...(needsTextSizeMigration ? { textSize: 1 } : {})
      };
      if (needsSoundDefaultMigration) localStorage.setItem(SOUND_SETTINGS_VERSION_KEY, "4");
      if (needsTextSizeMigration) localStorage.setItem(TEXT_SIZE_SETTINGS_VERSION_KEY, "1");
      return merged;
    }

    // v2 incorrectly defaulted Reduce Motion on for mobile/coarse pointers.
    // Migrate the other settings, but reset that buggy automatic default.
    for (const key of LEGACY_SETTINGS_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) || {};
      const migrated = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        reduceMotion: false,
        soundEffects: false,
        textSize: 1
      };

      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(migrated)
      );
      localStorage.setItem(SOUND_SETTINGS_VERSION_KEY, "4");

      return migrated;
    }
  } catch {}

  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  );

  window.dispatchEvent(
    new CustomEvent("glt-settings-updated", {
      detail: settings
    })
  );
}

export function applySettingsToDocument(settings) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.dataset.reduceMotion =
    settings.reduceMotion ? "1" : "0";

  root.dataset.compact =
    settings.compactMode ? "1" : "0";

  root.dataset.largeText =
    settings.largeText ? "1" : "0";

  const textSize = Math.min(1.3, Math.max(0.8, Number(settings.textSize) || 1));
  root.style.setProperty("--text-scale", String(textSize));
  root.dataset.textSize = String(textSize);

  root.dataset.accent = settings.themeColor || "yellow";
}

export const TEAMS = {
  AIY: {
    code: "AIY",
    name: "AIY",
    accent: "#ff6b5f",
    paper: "#ffd9c8",
    players: [
      "Arsh",
      "Ishaansh",
      "Yug"
    ]
  },

  NTV: {
    code: "NTV",
    name: "NTV",
    accent: "#5fa8ff",
    paper: "#d8ecff",
    players: [
      "Nishil",
      "Tanmay",
      "Vivaan"
    ]
  },

  ANA: {
    code: "ANA",
    name: "ANA",
    accent: "#f0a56b",
    paper: "#ffe2bd",
    players: [
      "Arnav",
      "Naisha",
      "Agastya/Arsh"
    ]
  },

  YAM: {
    code: "YAM",
    name: "YAM",
    accent: "#bb8cff",
    paper: "#e8d9ff",
    players: [
      "Yash",
      "Ayaansh",
      "Manan"
    ]
  }
};

export const MATCHES = {
  D1: {
    id: "D1",
    label: "DEMO 01",
    date: "14 MAY 2026",
    time: "19:00",
    t1: "AIY",
    t2: "NTV"
  },

  D2: {
    id: "D2",
    label: "DEMO 02",
    date: "15 MAY 2026",
    time: "16:30",
    t1: "ANA",
    t2: "YAM"
  }
};

export const matchPath = (id) =>
  sitePath(`/match?match=${encodeURIComponent(id)}`);

export const scorerPath = (id, superOverIndex = 0) => {
  const query = `match=${encodeURIComponent(id)}${Number(superOverIndex) > 0 ? `&super=${Number(superOverIndex)}` : ""}`;
  return sitePath(`/scorer.html?${query}`);
};

export function emptyLive() {
  return {
    striker: "",
    nonStriker: "",
    bowler: "",
    previousBowler: "",
    freeHit: false,
    ballType: "pace",
    retiredHurt: []
  };
}

export function emptyStage(index = 0) {
  return {
    index,
    status: "upcoming",
    innings: [],
    live: emptyLive(),
    result: null,
    toss: null,
    manualAdjustments: {}
  };
}

export function emptyMatch() {
  return {
    status: "upcoming",
    innings: [],
    live: emptyLive(),
    result: null,
    finalResult: null,
    toss: null,
    manualAdjustments: { main: {}, superOvers: [] },
    superOvers: []
  };
}

export function freshStore() {
  return {
    matches: Object.fromEntries(
      Object.keys(MATCHES).map((id) => [
        id,
        emptyMatch()
      ])
    )
  };
}