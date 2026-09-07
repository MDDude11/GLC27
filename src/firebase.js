const firebaseConfig = {
  apiKey: "AIzaSyAEv5vvanNf2aFbsz8qdcXv0AKZf5DrV0",
  authDomain: "glc2k27.firebaseapp.com",
  projectId: "glc2k27",
  storageBucket: "glc2k27.firebasestorage.app",
  messagingSenderId: "992129216745",
  appId: "1:992129216745:web:82f4e8f3793a22db494078",
  databaseURL: "https://glc2k27-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let firebasePromise;
const internalWriteQueues = new Map();

async function loadFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js")
    ]).then(([appModule, databaseModule]) => {
      const app = appModule.initializeApp(firebaseConfig);
      const database = databaseModule.getDatabase(app, firebaseConfig.databaseURL);

      return {
        database,
        ref: databaseModule.ref,
        onValue: databaseModule.onValue,
        get: databaseModule.get,
        set: databaseModule.set
      };
    });
  }

  return firebasePromise;
}

export async function watchFirebaseConnection(onChange) {
  try {
    const { database, ref, onValue } = await loadFirebase();

    return onValue(
      ref(database, ".info/connected"),
      (snapshot) => onChange(snapshot.val() === true)
    );
  } catch (error) {
    console.warn("Firebase connection could not be initialised.", error);
    onChange(false);
    return () => {};
  }
}

export async function subscribeFirebaseMatch(matchId, onMatch, onError) {
  try {
    const { database, ref, onValue } = await loadFirebase();

    return onValue(
      ref(database, `matches/${matchId}`),
      (snapshot) => {
        onMatch(snapshot.exists() ? snapshot.val() : null);
      },
      (error) => {
        console.warn(
          `Firebase match subscription failed for ${matchId}.`,
          error
        );
        onError?.(error);
      }
    );
  } catch (error) {
    console.warn(
      `Firebase match subscription could not start for ${matchId}.`,
      error
    );
    onError?.(error);
    return () => {};
  }
}

export async function writeFirebaseMatch(matchId, match) {
  const { database, ref, set } = await loadFirebase();
  await set(ref(database, `matches/${matchId}`), match);
}

export async function seedFirebaseMatch(matchId, match) {
  try {
    const { database, ref, get, set } = await loadFirebase();

    const snapshot = await get(
      ref(database, `matches/${matchId}`)
    );

    if (snapshot.exists()) {
      return snapshot.val();
    }

    await set(
      ref(database, `matches/${matchId}`),
      match
    );

    return match;
  } catch (error) {
    console.warn(
      `Firebase could not seed ${matchId}.`,
      error
    );
    return null;
  }
}

const INTERNAL_ROOT = "internalMatches";

export async function subscribeFirebaseInternalMatches(onMatches, onError) {
  let active = true;
  let sdkUnsubscribe = () => {};
  let pollTimer = null;
  let polling = false;

  const emit = (value) => {
    if (active) onMatches(value || {});
  };

  const pollOnce = async () => {
    try {
      const response = await fetch(
        firebaseRestUrl(INTERNAL_ROOT),
        { method: "GET", cache: "no-store", headers: { Accept: "application/json" } }
      );
      if (!response.ok) throw new Error(`Firebase REST GET failed (${response.status})`);
      emit(await response.json());
    } catch (error) {
      onError?.(error);
    }
  };

  const startPolling = () => {
    if (polling || !active) return;
    polling = true;
    const poll = async () => {
      if (!active) return;
      await pollOnce();
      if (active) pollTimer = window.setTimeout(poll, 1800);
    };
    void poll();
  };

  try {
    const { database, ref, onValue } = await loadFirebase();
    sdkUnsubscribe = onValue(
      ref(database, INTERNAL_ROOT),
      (snapshot) => emit(snapshot.exists() ? snapshot.val() : {}),
      (error) => {
        console.warn("Firebase internal match list subscription failed; using REST fallback.", error);
        onError?.(error);
        startPolling();
      }
    );
  } catch (error) {
    console.warn("Firebase internal match list subscription could not start; using REST fallback.", error);
    onError?.(error);
    startPolling();
  }

  return () => {
    active = false;
    sdkUnsubscribe?.();
    if (pollTimer) window.clearTimeout(pollTimer);
  };
}

async function readFirebaseInternalMatchRest(matchId) {
  const response = await fetch(
    firebaseRestUrl(
      `${INTERNAL_ROOT}/${encodeURIComponent(matchId)}`
    ),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Firebase REST GET failed (${response.status})`
    );
  }

  return response.json();
}

async function writeFirebaseInternalMatchRest(matchId, match) {
  const response = await fetch(
    firebaseRestUrl(
      `${INTERNAL_ROOT}/${encodeURIComponent(matchId)}`
    ),
    {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(match)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Firebase REST PUT failed (${response.status})`
    );
  }

  return response.json();
}

export async function subscribeFirebaseInternalMatch(
  matchId,
  onMatch,
  onError
) {
  let active = true;
  let sdkUnsubscribe = () => {};
  let pollTimer = null;
  let polling = false;
  let lastPayload = "";

  const emitRemote = (value) => {
    if (!active || value == null) return;

    let fingerprint = "";
    try {
      fingerprint = JSON.stringify(value);
    } catch {
      fingerprint = String(value);
    }

    // Firebase SDK and REST polling can observe the same write. De-dupe them so
    // the UI only re-renders when the actual remote match payload changes.
    if (fingerprint === lastPayload) return;
    lastPayload = fingerprint;
    onMatch(value);
  };

  const readOnce = async () => {
    try {
      // REST polling is intentionally always active for internal/public matches.
      // This makes the public viewer independent of whether the Firebase SDK's
      // browser realtime transport is working correctly on a given network.
      const remote = await readFirebaseInternalMatchRest(matchId);
      if (remote != null) emitRemote(remote);
      return true;
    } catch (error) {
      onError?.(error);
      return false;
    }
  };

  const startPolling = () => {
    if (polling || !active) return;
    polling = true;

    const poll = async () => {
      if (!active) return;
      await readOnce();
      if (active) pollTimer = window.setTimeout(poll, 1000);
    };

    void poll();
  };

  try {
    const { database, ref, onValue } = await loadFirebase();
    sdkUnsubscribe = onValue(
      ref(database, `${INTERNAL_ROOT}/${matchId}`),
      (snapshot) => {
        if (snapshot.exists()) emitRemote(snapshot.val());
      },
      (error) => {
        console.warn(
          `Firebase realtime subscription failed for ${matchId}; REST polling remains active.`,
          error
        );
        onError?.(error);
      }
    );
  } catch (error) {
    console.warn(
      `Firebase realtime subscription could not start for ${matchId}; using REST polling.`,
      error
    );
    onError?.(error);
  }

  // Always start polling, even when the SDK says it is connected. This is the
  // key reliability path for the public viewer and for separate browser tabs.
  startPolling();

  return () => {
    active = false;
    sdkUnsubscribe?.();
    if (pollTimer) window.clearTimeout(pollTimer);
  };
}

export function writeFirebaseInternalMatch(matchId, match) {
  const previous =
    internalWriteQueues.get(matchId) ||
    Promise.resolve();

  const next = previous
    .catch(() => {})
    .then(async () => {
      // Write through REST first and verify the server accepted the payload.
      // This avoids relying on an SDK write that can remain only in the local
      // Firebase client cache while appearing successful to the caller.
      try {
        await writeFirebaseInternalMatchRest(matchId, match);
        const verified = await readFirebaseInternalMatchRest(matchId);
        if (!verified) {
          throw new Error(`Firebase REST verification returned no record for ${matchId}.`);
        }
        return verified;
      } catch (restError) {
        console.warn(
          `Firebase REST write failed for ${matchId}; trying SDK write.`,
          restError
        );

        const { database, ref, get, set } = await loadFirebase();
        await set(
          ref(database, `${INTERNAL_ROOT}/${matchId}`),
          match
        );

        const verified = await get(
          ref(database, `${INTERNAL_ROOT}/${matchId}`)
        );
        if (!verified.exists()) {
          throw new Error(`Firebase SDK verification returned no record for ${matchId}.`);
        }
        return verified.val();
      }
    });

  internalWriteQueues.set(matchId, next);

  void next.finally(() => {
    if (internalWriteQueues.get(matchId) === next) {
      internalWriteQueues.delete(matchId);
    }
  });

  return next;
}

export async function seedFirebaseInternalMatch(
  matchId,
  match
) {
  // Prefer the SDK, but fall back to the same RTDB REST endpoint used by the
  // viewer when the SDK cannot initialise or a browser/network path rejects it.
  try {
    const { database, ref, get, set } = await loadFirebase();
    const snapshot = await get(ref(database, `${INTERNAL_ROOT}/${matchId}`));

    if (snapshot.exists()) return snapshot.val();

    await set(ref(database, `${INTERNAL_ROOT}/${matchId}`), match);

    // Verify through the same SDK connection first. If that read fails, the
    // outer catch below falls back to REST rather than manufacturing local data.
    const verified = await get(ref(database, `${INTERNAL_ROOT}/${matchId}`));
    if (!verified.exists()) throw new Error(`Firebase did not persist internal match ${matchId}.`);
    return verified.val();
  } catch (error) {
    console.warn(
      `Firebase SDK seed failed for ${matchId}; trying REST seed.`,
      error
    );

    const existing = await readFirebaseInternalMatchRest(matchId);
    if (existing != null) return existing;

    return writeFirebaseInternalMatchRest(matchId, match);
  }
}

export async function getFirebaseInternalMatch(
  matchId
) {
  try {
    const { database, ref, get } = await loadFirebase();
    const snapshot = await get(ref(database, `${INTERNAL_ROOT}/${matchId}`));
    if (snapshot.exists()) return snapshot.val();
    return null;
  } catch (error) {
    console.warn(
      `Firebase SDK read failed for ${matchId}; trying REST read.`,
      error
    );
    return readFirebaseInternalMatchRest(matchId);
  }
}

export async function listFirebaseInternalMatches() {
  try {
    const { database, ref, get } = await loadFirebase();
    const snapshot = await get(ref(database, INTERNAL_ROOT));
    return snapshot.exists() ? (snapshot.val() || {}) : {};
  } catch (error) {
    console.warn(
      "Firebase SDK internal match list read failed; trying REST read.",
      error
    );

    const response = await fetch(
      firebaseRestUrl(INTERNAL_ROOT),
      { method: "GET", cache: "no-store", headers: { Accept: "application/json" } }
    );

    if (!response.ok) throw new Error(`Firebase REST GET failed (${response.status})`);
    return (await response.json()) || {};
  }
}

export async function deleteFirebaseInternalMatch(matchId) {
  try {
    const { database, ref, get, set } = await loadFirebase();
    await set(ref(database, `${INTERNAL_ROOT}/${matchId}`), null);

    const verified = await get(ref(database, `${INTERNAL_ROOT}/${matchId}`));
    if (verified.exists()) throw new Error(`Firebase did not delete internal match ${matchId}.`);
    return true;
  } catch (error) {
    console.warn(
      `Firebase SDK delete failed for ${matchId}; trying REST delete.`,
      error
    );

    const response = await fetch(
      firebaseRestUrl(`${INTERNAL_ROOT}/${encodeURIComponent(matchId)}`),
      { method: "DELETE", cache: "no-store", headers: { Accept: "application/json" } }
    );

    if (!response.ok) throw new Error(`Firebase REST DELETE failed (${response.status})`);
    return true;
  }
}

export async function writeFirebaseInternalPlayerStats(
  stats
) {
  const {
    database,
    ref,
    set
  } = await loadFirebase();

  await set(
    ref(database, "internalPlayerStats"),
    stats
  );
}