import {
  emptyMatch,
  freshStore,
  STORAGE_KEY,
  LEGACY_STORAGE_KEYS
} from "./data.js";

import {
  clone,
  normalizeDeliveries,
  playerStatsForMatch
} from "./engine.js";

import {
  seedFirebaseMatch,
  subscribeFirebaseMatch,
  writeFirebaseMatch,
  getFirebaseInternalMatch,
  listFirebaseInternalMatches,
  seedFirebaseInternalMatch,
  writeFirebaseInternalMatch,
  deleteFirebaseInternalMatch,
  writeFirebaseInternalPlayerStats
} from "./firebase.js";

import {
  INTERNAL_STORAGE_KEY,
  isInternalMatchId
} from "./admin.js";

const WRITE_QUEUE_KEY = "glt_drafts_firebase_write_queue_v21";
const PREVIOUS_WRITE_QUEUE_KEYS = ["glt_drafts_firebase_write_queue_v19"];
const LEGACY_WRITE_QUEUE_KEYS = ["glt_drafts_firebase_write_queue_v20", "glt_drafts_firebase_write_queue_v18", "glt_drafts_firebase_write_queue_v17"];
const flushLocks = new Set();
const matchWriteChains = new Map();

function writeFirebaseMatchInOrder(matchId, match) {
  const previous = matchWriteChains.get(matchId) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => writeFirebaseMatch(matchId, match));
  matchWriteChains.set(matchId, current.finally(() => {
    if (matchWriteChains.get(matchId) === current) matchWriteChains.delete(matchId);
  }));
  return current;
}

function readWriteQueue() {
  if (typeof window === "undefined") return [];
  const merged = new Map();
  for (const key of [WRITE_QUEUE_KEY, ...PREVIOUS_WRITE_QUEUE_KEYS, ...LEGACY_WRITE_QUEUE_KEYS]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(parsed)) continue;
      for (const entry of parsed) {
        if (!entry?.matchId) continue;
        const current = merged.get(entry.matchId);
        if (!current || Number(entry.revision) >= Number(current.revision)) {
          merged.set(entry.matchId, entry);
        }
      }
    } catch {}
  }
  return [...merged.values()];
}

function saveWriteQueue(queue) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function nextRevision(match) {
  return Math.max(0, Number(match?.revision) || 0) + 1;
}

function enqueueFirebaseMatchWrite(matchId, match) {
  const queue = readWriteQueue().filter((entry) => entry.matchId !== matchId);
  queue.push({ matchId, revision: Number(match?.revision) || 0, match });
  saveWriteQueue(queue.slice(-50));
  if (navigator.onLine !== false) void flushPendingWrites();
}

export async function flushPendingWrites() {
  if (typeof window === "undefined" || navigator.onLine === false || flushLocks.has("firebase")) return;
  if (!readWriteQueue().length) return;
  flushLocks.add("firebase");
  try {
    while (navigator.onLine !== false) {
      const queue = readWriteQueue();
      if (!queue.length) break;
      const item = queue[0];
      try {
        await writeFirebaseMatchInOrder(item.matchId, item.match);
        const latest = readWriteQueue();
        const index = latest.findIndex((entry) => entry.matchId === item.matchId && Number(entry.revision) === Number(item.revision));
        if (index >= 0) latest.splice(index, 1);
        saveWriteQueue(latest);
      } catch (error) {
        console.warn(`Firebase queued write paused for ${item.matchId}.`, error);
        break;
      }
    }
  } finally {
    flushLocks.delete("firebase");
  }
}


function normalizeSuperOvers(value) {
  if (!Array.isArray(value)) return [];
  return value.map((stage, index) => ({
    ...stage,
    index: index + 1,
    stage: "superOver",
    innings: Array.isArray(stage?.innings)
      ? stage.innings.map((inn) => ({ ...inn, deliveries: normalizeDeliveries(inn?.deliveries) }))
      : [],
    live: { ...emptyMatch().live, ...(stage?.live || {}) }
  }));
}
function normalizeStore(parsed) {
  if (!parsed?.matches) return null;

  const normalized = {
    matches: {}
  };

  for (const [id, match] of Object.entries(parsed.matches)) {
    normalized.matches[id] = {
      ...emptyMatch(),
      ...match,
      innings: Array.isArray(match?.innings)
        ? match.innings.map((inn) => ({
            ...inn,
            deliveries: normalizeDeliveries(inn?.deliveries)
          }))
        : [],
      live: {
        ...emptyMatch().live,
        ...(match.live || {})
      },
      superOvers: normalizeSuperOvers(match?.superOvers)
    };
  }

  return normalized;
}

function persistLocalStore(store) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(store)
  );
}

function persistInternalStore(store) {
  localStorage.setItem(
    INTERNAL_STORAGE_KEY,
    JSON.stringify(store)
  );
}

export function loadStore() {
  if (typeof window === "undefined") {
    return freshStore();
  }

  try {
    for (const key of [
      STORAGE_KEY,
      ...LEGACY_STORAGE_KEYS
    ]) {
      const parsed = normalizeStore(
        JSON.parse(
          localStorage.getItem(key) || "null"
        )
      );

      if (
        parsed?.matches?.D1 &&
        parsed?.matches?.D2
      ) {
        if (key !== STORAGE_KEY) {
          persistLocalStore(parsed);
        }

        return parsed;
      }
    }
  } catch {}

  return freshStore();
}

function normalizeInternalStore(parsed) {
  if (
    !parsed?.matches ||
    typeof parsed.matches !== "object"
  ) {
    return {
      matches: {}
    };
  }

  const matches = {};

  for (const [id, match] of Object.entries(
    parsed.matches
  )) {
    matches[id] = {
      ...emptyMatch(),
      ...match,

      id: match?.id || id,

      live: {
        ...emptyMatch().live,
        ...(match?.live || {})
      },

      innings: Array.isArray(match?.innings)
        ? match.innings.map((inn) => ({
            ...inn,
            deliveries: normalizeDeliveries(inn?.deliveries)
          }))
        : [],
      superOvers: normalizeSuperOvers(match?.superOvers)
    };
  }

  return {
    ...parsed,
    matches
  };
}

export function loadInternalStore() {
  if (typeof window === "undefined") {
    return {
      matches: {}
    };
  }

  try {
    return normalizeInternalStore(
      JSON.parse(
        localStorage.getItem(
          INTERNAL_STORAGE_KEY
        ) || "null"
      )
    );
  } catch {
    return {
      matches: {}
    };
  }
}

export function saveStore(store) {
  persistLocalStore(store);
}

export function saveInternalStore(store) {
  persistInternalStore(store);
}

export function getMatch(id) {
  if (isInternalMatchId(id)) {
    return (
      loadInternalStore().matches[id] ||
      emptyMatch()
    );
  }

  return (
    loadStore().matches[id] ||
    emptyMatch()
  );
}

function buildInternalCareerStats(matches) {
  const aggregate = {};

  for (const match of Object.values(matches || {})) {
    const stats =
      match.playerStats ||
      playerStatsForMatch(match);

    for (const [player, s] of Object.entries(stats)) {
      aggregate[player] ||= {
        matches: 0,

        batting: {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          highestScore: 0,
          strikeRate: "0.00"
        },

        bowling: {
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
          overs: "0.0",
          economy: "0.00"
        },

        fielding: {
          catches: 0,
          runOuts: 0,
          stumpings: 0
        }
      };

      aggregate[player].matches += 1;

      aggregate[player].batting.runs +=
        Number(s.batting?.runs) || 0;

      aggregate[player].batting.balls +=
        Number(s.batting?.balls) || 0;

      aggregate[player].batting.fours +=
        Number(s.batting?.fours) || 0;

      aggregate[player].batting.sixes +=
        Number(s.batting?.sixes) || 0;

      aggregate[player].batting.highestScore =
        Math.max(
          aggregate[player].batting.highestScore,
          Number(
            s.batting?.highestScore
          ) || 0
        );

      aggregate[player].bowling.balls +=
        Number(s.bowling?.balls) || 0;

      aggregate[player].bowling.runs +=
        Number(s.bowling?.runs) || 0;

      aggregate[player].bowling.wickets +=
        Number(s.bowling?.wickets) || 0;

      aggregate[player].bowling.wides +=
        Number(s.bowling?.wides) || 0;

      aggregate[player].bowling.noBalls +=
        Number(s.bowling?.noBalls) || 0;

      aggregate[player].fielding.catches +=
        Number(s.fielding?.catches) || 0;

      aggregate[player].fielding.runOuts +=
        Number(s.fielding?.runOuts) || 0;

      aggregate[player].fielding.stumpings +=
        Number(s.fielding?.stumpings) || 0;
    }
  }

  for (const s of Object.values(aggregate)) {
    s.batting.strikeRate =
      s.batting.balls
        ? (
            (s.batting.runs /
              s.batting.balls) *
            100
          ).toFixed(2)
        : "0.00";

    s.bowling.overs =
      `${Math.floor(
        s.bowling.balls / 6
      )}.${s.bowling.balls % 6}`;

    s.bowling.economy =
      s.bowling.balls
        ? (
            s.bowling.runs /
            (s.bowling.balls / 6)
          ).toFixed(2)
        : "0.00";
  }

  return aggregate;
}

function syncInternalMatch(matchId, match) {
  const currentMatches =
    loadInternalStore().matches;

  const normalizedMatch = {
    ...match,
    innings: Array.isArray(match?.innings)
      ? match.innings.map((inn) => ({ ...inn, deliveries: normalizeDeliveries(inn?.deliveries) }))
      : [],
    superOvers: normalizeSuperOvers(match?.superOvers)
  };

  const withStats = {
    ...normalizedMatch,

    revision: nextRevision(normalizedMatch),

    playerStats:
      playerStatsForMatch(normalizedMatch),

    updatedAt:
      new Date().toISOString()
  };

  const merged = {
    ...currentMatches,
    [matchId]: withStats
  };

  const careerStats =
    buildInternalCareerStats(merged);

  try {
    persistInternalStore({
      matches: merged
    });
  } catch {}

  enqueueFirebaseMatchWrite(matchId, withStats);

  void writeFirebaseInternalPlayerStats(
    careerStats
  ).catch((error) => {
    console.warn(
      "Firebase internal player stats write failed.",
      error
    );
  });

  return withStats;
}

export function getInternalFixtureLocal(id) {
  return (
    loadInternalStore().matches[id] ||
    null
  );
}

function normalizeInternalRemoteMatch(
  id,
  remote
) {
  if (!remote) return null;

  return {
    ...emptyMatch(),
    ...remote,

    id:
      remote.id ||
      id,

    internal: true,

    t1:
      remote.t1 ||
      "A",

    t2:
      remote.t2 ||
      "B",

    teams:
      remote.teams ||
      {},

    innings:
      Array.isArray(remote.innings)
        ? remote.innings.map((inn) => ({
            ...inn,

            deliveries: normalizeDeliveries(inn?.deliveries)
          }))
        : [],

    live: {
      ...emptyMatch().live,
      ...(remote.live || {})
    },
    superOvers: normalizeSuperOvers(remote?.superOvers)
  };
}

export async function resolveMatchFixture(id) {
  if (!isInternalMatchId(id)) {
    const { MATCHES } =
      await import("./data.js");

    return MATCHES[id] || null;
  }

  // Firebase is authoritative for internal/public matches.
  try {
    const remote =
      await getFirebaseInternalMatch(id);

    if (remote) {
      const normalized =
        normalizeInternalRemoteMatch(
          id,
          remote
        );

      const store =
        loadInternalStore();

      store.matches[id] =
        normalized;

      persistInternalStore(store);

      return normalized;
    }

    // A successful Firebase read returning null means the match does not exist.
    // Remove any stale local cache so deleted internal matches cannot reappear.
    const localStore = loadInternalStore();
    if (localStore.matches[id]) {
      delete localStore.matches[id];
      persistInternalStore(localStore);
    }
    return null;
  } catch (error) {
    console.warn(
      `Unable to resolve internal Firebase match ${id}.`,
      error
    );
  }

  return getInternalFixtureLocal(id);
}

export async function listInternalMatches() {
  const local =
    loadInternalStore().matches;

  try {
    const remote =
      await listFirebaseInternalMatches();

    const normalizedRemote = {};

    for (const [id, match] of Object.entries(
      remote || {}
    )) {
      normalizedRemote[id] =
        normalizeInternalRemoteMatch(
          id,
          match
        );
    }

    // A successful Firebase list is authoritative. Do not resurrect deleted or
    // never-persisted matches from localStorage. Local data is only an offline fallback.
    persistInternalStore({
      matches: normalizedRemote
    });

    return normalizedRemote;
  } catch (error) {
    console.warn(
      "Unable to list internal Firebase matches.",
      error
    );

    return local;
  }
}

export async function createInternalMatch(match) {
  const withStats = {
    ...match,
    revision: nextRevision(match),
    playerStats: playerStatsForMatch(match),
    updatedAt: new Date().toISOString()
  };

  // Firebase is authoritative. Do not persist a local "ghost" match until the
  // remote record has been created and verified. This is what makes a newly
  // created internal match immediately usable from another browser/incognito.
  const remote = await seedFirebaseInternalMatch(
    match.id,
    withStats
  );

  const saved = normalizeInternalRemoteMatch(
    match.id,
    remote || withStats
  );

  const store = loadInternalStore();
  store.matches[match.id] = saved;
  persistInternalStore(store);

  window.dispatchEvent(
    new CustomEvent(
      "glt-internal-match-updated",
      { detail: match.id, remote: true }
    )
  );

  return saved;
}

export async function deleteInternalMatch(id) {
  if (!isInternalMatchId(id)) {
    throw new Error("Only internal test matches can be deleted here.");
  }

  await deleteFirebaseInternalMatch(id);

  const store = loadInternalStore();
  delete store.matches[id];
  persistInternalStore(store);

  // Keep the aggregate internal player-stat store consistent with the deleted
  // match. A match deletion must remove its contribution to career totals too.
  try {
    await writeFirebaseInternalPlayerStats(
      buildInternalCareerStats(store.matches)
    );
  } catch (error) {
    console.warn(
      "Firebase internal player stats cleanup failed after match deletion.",
      error
    );
  }

  window.dispatchEvent(
    new CustomEvent(
      "glt-internal-match-updated",
      { detail: id, deleted: true, remote: true }
    )
  );

  return true;
}

export function resetMatch(id) {
  if (isInternalMatchId(id)) {
    const store =
      loadInternalStore();

    if (!store.matches[id]) {
      return emptyMatch();
    }

    const current =
      store.matches[id];

    const reset = {
      ...emptyMatch(),

      id,

      label:
        current.label,

      date:
        current.date,

      time:
        current.time,

      venue:
        current.venue,

      internal: true,

      t1: "A",
      t2: "B",

      teams:
        current.teams,

      playerStats: {}
    };

    const resetWithRevision = { ...reset, revision: nextRevision(current), updatedAt: new Date().toISOString() };
    store.matches[id] = resetWithRevision;
    persistInternalStore(store);
    enqueueFirebaseMatchWrite(id, resetWithRevision);

    window.dispatchEvent(
      new CustomEvent(
        "glt-internal-match-updated",
        {
          detail: id
        }
      )
    );

    return resetWithRevision;
  }

  const store =
    loadStore();
  const resetBase = emptyMatch();
  store.matches[id] = { ...resetBase, id, revision: nextRevision(store.matches[id]), updatedAt: new Date().toISOString() };
  saveStore(store);
  enqueueFirebaseMatchWrite(id, store.matches[id]);

  window.dispatchEvent(
    new CustomEvent(
      "glt-match-updated",
      {
        detail: id
      }
    )
  );

  return store.matches[id];
}

export async function commitMatchUpdate(id, updater, { requireLiveStart = false } = {}) {
  const internal = isInternalMatchId(id);
  const store = internal ? loadInternalStore() : loadStore();
  const previous = clone(store.matches[id] || getMatch(id) || emptyMatch());
  const current = clone(previous);
  const nextBase = typeof updater === "function"
    ? updater(current)
    : { ...current, ...(updater || {}) };
  const normalizedNextBase = {
    ...nextBase,
    innings: Array.isArray(nextBase?.innings)
      ? nextBase.innings.map((inn) => ({ ...inn, deliveries: normalizeDeliveries(inn?.deliveries) }))
      : [],
    superOvers: normalizeSuperOvers(nextBase?.superOvers),
    live: { ...emptyMatch().live, ...(nextBase?.live || {}) }
  };
  const next = internal
    ? {
        ...normalizedNextBase,
        id,
        internal: true,
        revision: nextRevision(previous),
        playerStats: playerStatsForMatch(normalizedNextBase),
        updatedAt: new Date().toISOString()
      }
    : {
        ...normalizedNextBase,
        id,
        revision: nextRevision(previous),
        updatedAt: new Date().toISOString()
      };

  // Start actions are intentionally remote-first. The UI must not report a
  // match as started until the authoritative Firebase write has completed.
  await writeFirebaseMatchInOrder(id, next);

  if (requireLiveStart) {
    const verified = await getFirebaseInternalMatch(id);
    if (!verified || verified.status !== "live" || !Array.isArray(verified.innings) || verified.innings.length < 1) {
      throw new Error(`Firebase did not verify the live start for ${id}.`);
    }
  }

  if (internal) {
    store.matches[id] = next;
    persistInternalStore(store);
  } else {
    store.matches[id] = next;
    persistLocalStore(store);
  }

  window.dispatchEvent(
    new CustomEvent(internal ? "glt-internal-match-updated" : "glt-match-updated", {
      detail: id,
      remote: true
    })
  );

  return { previous, next: clone(next) };
}

export function patchMatch(id, updater) {
  if (isInternalMatchId(id)) {
    return patchInternalMatch(
      id,
      updater
    );
  }

  const store =
    loadStore();

  const previous =
    clone(
      store.matches[id] ||
      emptyMatch()
    );

  const current =
    clone(previous);

  const nextBase = typeof updater === "function"
    ? updater(current)
    : { ...current, ...(updater || {}) };

  store.matches[id] = {
    ...nextBase,
    id,
    innings: Array.isArray(nextBase?.innings)
      ? nextBase.innings.map((inn) => ({ ...inn, deliveries: normalizeDeliveries(inn?.deliveries) }))
      : [],
    superOvers: normalizeSuperOvers(nextBase?.superOvers),
    revision: nextRevision(previous),
    updatedAt: new Date().toISOString()
  };

  saveStore(store);
  enqueueFirebaseMatchWrite(id, store.matches[id]);

  window.dispatchEvent(
    new CustomEvent(
      "glt-match-updated",
      {
        detail: id
      }
    )
  );

  return {
    previous,

    next:
      clone(
        store.matches[id]
      )
  };
}

export function patchInternalMatch(
  id,
  updater
) {
  const store =
    loadInternalStore();

  const previous =
    clone(
      store.matches[id] ||
      emptyMatch()
    );

  const current =
    clone(previous);

  const nextBase =
    typeof updater === "function"
      ? updater(current)
      : { ...current, ...(updater || {}) };

  const next =
    syncInternalMatch(
      id,
      nextBase
    );

  store.matches[id] =
    next;

  persistInternalStore(store);

  window.dispatchEvent(
    new CustomEvent(
      "glt-internal-match-updated",
      {
        detail: id
      }
    )
  );

  return {
    previous,

    next:
      clone(next)
  };
}

export function useLiveMatchState(
  id,
  setState
) {
  const internal = isInternalMatchId(id);
  const eventName = internal
    ? "glt-internal-match-updated"
    : "glt-match-updated";

  let active = true;
  let unsubscribeFirebase = () => {};

  try {
    setState(clone(getMatch(id)));
  } catch {}

  const refresh = (event) => {
    if (
      !event ||
      event.detail === id ||
      event.key === (internal ? INTERNAL_STORAGE_KEY : STORAGE_KEY)
    ) {
      setState(getMatch(id));
    }
  };

  window.addEventListener("storage", refresh);
  window.addEventListener(eventName, refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("online", flushPendingWrites);
  document.addEventListener("visibilitychange", refresh);
  void flushPendingWrites();

  void (async () => {
    let existing = null;

    try {
      if (internal) {
        // Existing v14.x ITB matches are migrated from the legacy location once;
        // all live reads after that use the normal matches/{id} path.
        existing = await getFirebaseInternalMatch(id);
      } else {
        existing = await seedFirebaseMatch(id, getMatch(id));
      }
    } catch (error) {
      console.warn(`Firebase initial read failed for ${id}.`, error);
    }

    if (!active) return;

    if (existing) {
      const normalized = internal
        ? normalizeInternalRemoteMatch(id, existing)
        : normalizeStore({ matches: { [id]: existing } }).matches[id];

      if (internal) {
        const store = loadInternalStore();
        store.matches[id] = normalized;
        persistInternalStore(store);
      } else {
        const store = loadStore();
        store.matches[id] = normalized;
        persistLocalStore(store);
      }

      setState(clone(normalized));
    }

    // IMPORTANT: every match ID, including ITB IDs, subscribes to the exact
    // same Firebase matches/{id} listener used by the demo matches.
    const unsubscribe = await subscribeFirebaseMatch(
      id,
      (remoteMatch) => {
        if (!active) return;

        if (!remoteMatch) {
          if (internal) {
            const store = loadInternalStore();
            if (store.matches[id]) {
              delete store.matches[id];
              persistInternalStore(store);
            }
          } else {
            const store = loadStore();
            delete store.matches[id];
            persistLocalStore(store);
          }
          return;
        }

        const localCurrent = getMatch(id);
        const localRevision = Number(localCurrent?.revision) || 0;
        const remoteRevision = Number(remoteMatch?.revision) || 0;
        if (remoteRevision < localRevision) return;
        const localTime = Date.parse(localCurrent?.updatedAt || "");
        const remoteTime = Date.parse(remoteMatch?.updatedAt || "");
        if (remoteRevision === localRevision && Number.isFinite(localTime) && Number.isFinite(remoteTime) && remoteTime < localTime) return;

        const normalized = internal
          ? normalizeInternalRemoteMatch(id, remoteMatch)
          : normalizeStore({ matches: { [id]: remoteMatch } }).matches[id];

        if (internal) {
          const store = loadInternalStore();
          store.matches[id] = normalized;
          persistInternalStore(store);
        } else {
          const store = loadStore();
          store.matches[id] = normalized;
          persistLocalStore(store);
        }

        setState(clone(normalized));

        window.dispatchEvent(
          new CustomEvent(eventName, {
            detail: id,
            remote: true
          })
        );
      },
      (error) => {
        console.warn(`Live Firebase subscription failed for ${id}.`, error);
      }
    );

    if (active && typeof unsubscribe === "function") {
      unsubscribeFirebase = unsubscribe;
    } else {
      unsubscribe?.();
    }
  })();

  return () => {
    active = false;
    unsubscribeFirebase?.();
    window.removeEventListener("storage", refresh);
    window.removeEventListener(eventName, refresh);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("online", flushPendingWrites);
    document.removeEventListener("visibilitychange", refresh);
  };
}
