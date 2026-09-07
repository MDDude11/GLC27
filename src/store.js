import {
  emptyMatch,
  freshStore,
  STORAGE_KEY,
  LEGACY_STORAGE_KEYS
} from "./data.js";

import {
  clone,
  playerStatsForMatch
} from "./engine.js";

import {
  seedFirebaseMatch,
  subscribeFirebaseMatch,
  writeFirebaseMatch,
  getFirebaseInternalMatch,
  listFirebaseInternalMatches,
  seedFirebaseInternalMatch,
  subscribeFirebaseInternalMatch,
  writeFirebaseInternalMatch,
  writeFirebaseInternalPlayerStats
} from "./firebase.js";

import {
  INTERNAL_STORAGE_KEY,
  isInternalMatchId
} from "./admin.js";

function normalizeStore(parsed) {
  if (!parsed?.matches) return null;

  const normalized = {
    matches: {}
  };

  for (const [id, match] of Object.entries(parsed.matches)) {
    normalized.matches[id] = {
      ...emptyMatch(),
      ...match,
      live: {
        ...emptyMatch().live,
        ...(match.live || {})
      }
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
            deliveries: Array.isArray(
              inn?.deliveries
            )
              ? inn.deliveries
              : []
          }))
        : []
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

  const withStats = {
    ...match,

    playerStats:
      playerStatsForMatch(match),

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

  void writeFirebaseInternalMatch(
    matchId,
    withStats
  ).catch((error) => {
    console.warn(
      `Firebase internal write failed for ${matchId}.`,
      error
    );
  });

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

            deliveries:
              Array.isArray(
                inn?.deliveries
              )
                ? inn.deliveries
                : []
          }))
        : [],

    live: {
      ...emptyMatch().live,
      ...(remote.live || {})
    }
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

    const merged = {
      ...local,
      ...normalizedRemote
    };

    persistInternalStore({
      matches: merged
    });

    return merged;
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

    playerStats:
      playerStatsForMatch(match),

    updatedAt:
      new Date().toISOString()
  };

  const store =
    loadInternalStore();

  store.matches[match.id] =
    withStats;

  persistInternalStore(store);

  await seedFirebaseInternalMatch(
    match.id,
    withStats
  );

  window.dispatchEvent(
    new CustomEvent(
      "glt-internal-match-updated",
      {
        detail: match.id
      }
    )
  );

  return withStats;
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

    store.matches[id] =
      reset;

    persistInternalStore(store);

    void writeFirebaseInternalMatch(
      id,
      reset
    ).catch((error) =>
      console.warn(
        "Firebase internal reset sync failed.",
        error
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "glt-internal-match-updated",
        {
          detail: id
        }
      )
    );

    return reset;
  }

  const store =
    loadStore();

  store.matches[id] =
    emptyMatch();

  saveStore(store);

  void writeFirebaseMatch(
    id,
    store.matches[id]
  ).catch((error) =>
    console.warn(
      "Firebase reset sync failed.",
      error
    )
  );

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

  store.matches[id] =
    typeof updater === "function"
      ? updater(current)
      : updater;

  saveStore(store);

  void writeFirebaseMatch(
    id,
    store.matches[id]
  ).catch((error) =>
    console.warn(
      `Firebase write failed for ${id}.`,
      error
    )
  );

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
      : updater;

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
  const internal =
    isInternalMatchId(id);

  let active = true;

  let unsubscribeFirebase =
    () => {};

  const eventName =
    internal
      ? "glt-internal-match-updated"
      : "glt-match-updated";

  const refresh = (event) => {
    if (
      !event ||
      event.detail === id ||
      event.key ===
        (
          internal
            ? INTERNAL_STORAGE_KEY
            : STORAGE_KEY
        )
    ) {
      setState(
        getMatch(id)
      );
    }
  };

  window.addEventListener(
    "storage",
    refresh
  );

  window.addEventListener(
    eventName,
    refresh
  );

  window.addEventListener(
    "focus",
    refresh
  );

  document.addEventListener(
    "visibilitychange",
    refresh
  );

  void (async () => {
    if (internal) {
      let existing = null;

      try {
        existing =
          await getFirebaseInternalMatch(
            id
          );
      } catch (error) {
        console.warn(
          `Firebase internal seed failed for ${id}.`,
          error
        );
      }

      if (!active) return;

      if (existing) {
        const normalized =
          normalizeInternalRemoteMatch(
            id,
            existing
          );

        const store =
          loadInternalStore();

        store.matches[id] =
          normalized;

        persistInternalStore(store);

        setState(
          clone(normalized)
        );
      }

      const unsubscribe =
        await subscribeFirebaseInternalMatch(
          id,
          (remoteMatch) => {
            if (
              !active ||
              !remoteMatch
            ) {
              return;
            }

            const normalized =
              normalizeInternalRemoteMatch(
                id,
                remoteMatch
              );

            const store =
              loadInternalStore();

            store.matches[id] =
              normalized;

            persistInternalStore(store);

            setState(
              clone(normalized)
            );

            window.dispatchEvent(
              new CustomEvent(
                eventName,
                {
                  detail: id,
                  remote: true
                }
              )
            );
          }
        );

      if (
        active &&
        typeof unsubscribe ===
          "function"
      ) {
        unsubscribeFirebase =
          unsubscribe;
      } else {
        unsubscribe?.();
      }

      return;
    }

    const existing =
      await seedFirebaseMatch(
        id,
        getMatch(id)
      );

    if (!active) return;

    if (existing) {
      const store =
        loadStore();

      store.matches[id] =
        normalizeStore({
          matches: {
            [id]: existing
          }
        }).matches[id];

      persistLocalStore(store);

      setState(
        store.matches[id]
      );
    }

    const unsubscribe =
      await subscribeFirebaseMatch(
        id,
        (remoteMatch) => {
          if (
            !active ||
            !remoteMatch
          ) {
            return;
          }

          const normalized =
            normalizeStore({
              matches: {
                [id]: remoteMatch
              }
            }).matches[id];

          const store =
            loadStore();

          store.matches[id] =
            normalized;

          persistLocalStore(store);

          setState(
            clone(normalized)
          );

          window.dispatchEvent(
            new CustomEvent(
              "glt-match-updated",
              {
                detail: id,
                remote: true
              }
            )
          );
        }
      );

    if (
      active &&
      typeof unsubscribe ===
        "function"
    ) {
      unsubscribeFirebase =
        unsubscribe;
    } else {
      unsubscribe?.();
    }
  })();

  return () => {
    active = false;

    unsubscribeFirebase?.();

    window.removeEventListener(
      "storage",
      refresh
    );

    window.removeEventListener(
      eventName,
      refresh
    );

    window.removeEventListener(
      "focus",
      refresh
    );

    document.removeEventListener(
      "visibilitychange",
      refresh
    );
  };
}