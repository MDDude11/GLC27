export const ADMIN_SESSION_KEY = "glt_drafts_internal_admin_v11";
export const ADMIN_PASSWORD = import.meta.env?.VITE_ADMIN_PASSWORD || "DRAFTSADMIN11";
export const INTERNAL_MATCH_PREFIX = "ITB11-";
export const INTERNAL_STORAGE_KEY = "glt_drafts_internal_matches_v11";

export const ADMIN_ROSTER = [
  "Arsh", "Ishaansh", "Yug",
  "Arnav", "Naisha", "Agastya/Arsh",
  "Nishil", "Tanmay", "Vivaan",
  "Manaansh", "Aarya", "Paranjay",
  "Yash", "Ayaansh", "Manan"
];

export const isInternalMatchId = (id = "") => String(id).startsWith(INTERNAL_MATCH_PREFIX);

export function createEmptyInternalMatch({ id, label, date, time, venue = "", teamA, teamB }) {
  return {
    id,
    label: label || id,
    date: date || "",
    time: time || "",
    venue: venue || "",
    type: "internal",
    status: "upcoming",
    teams: {
      A: { code: teamA.code, name: teamA.name, accent: teamA.accent, paper: teamA.paper, players: [...teamA.players] },
      B: { code: teamB.code, name: teamB.name, accent: teamB.accent, paper: teamB.paper, players: [...teamB.players] }
    },
    t1: "A",
    t2: "B",
    toss: null,
    innings: [],
    live: { striker: "", nonStriker: "", bowler: "", previousBowler: "", freeHit: false },
    result: null,
    playerStats: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function fixtureFromInternalMatch(match) {
  if (!match?.id || !match?.teams) return null;
  return {
    id: match.id,
    label: match.label || match.id,
    date: match.date || "TBD",
    time: match.time || "TBD",
    venue: match.venue || "",
    t1: "A",
    t2: "B",
    internal: true,
    teams: match.teams
  };
}
