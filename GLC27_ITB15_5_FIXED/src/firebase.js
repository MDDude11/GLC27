const firebaseConfig = {
  apiKey: "AIzaSyAEv5vvanNf2aFbsz8qdcXv0AKZf5DrV0",
  authDomain: "glc2k27.firebaseapp.com",
  projectId: "glc2k27",
  storageBucket: "glc2k27.firebasestorage.app",
  messagingSenderId: "992129216745",
  appId: "1:992129216745:web:82f4e8f3793a22db494078",
  databaseURL: "https://glc2k27-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const MATCHES_ROOT = "matches";
const LEGACY_INTERNAL_ROOT = "internalMatches";
const LEGACY_INTERNAL_PREFIX = "ITB11-";
const INTERNAL_MATCH_PREFIX = "custom-";
const isInternalMatchRecord = (id = "") => {
  const value = String(id);
  return value.startsWith(INTERNAL_MATCH_PREFIX) || value.startsWith(LEGACY_INTERNAL_PREFIX);
};

let firebasePromise;

function firebaseRestUrl(path = "") {
  const base = firebaseConfig.databaseURL.replace(/\/$/, "");
  return `${base}/${path}.json`;
}

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

/* -------------------------------------------------------------------------- */
/* One live-match data path: matches/{id}.                                   */
/* Demo matches and ITB custom matches both use these exact functions.      */
/* -------------------------------------------------------------------------- */

export async function subscribeFirebaseMatch(matchId, onMatch, onError) {
  try {
    const { database, ref, onValue } = await loadFirebase();

    return onValue(
      ref(database, `${MATCHES_ROOT}/${matchId}`),
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
  await set(ref(database, `${MATCHES_ROOT}/${matchId}`), match);
}

export async function seedFirebaseMatch(matchId, match) {
  try {
    const { database, ref, get, set } = await loadFirebase();
    const matchRef = ref(database, `${MATCHES_ROOT}/${matchId}`);
    const snapshot = await get(matchRef);

    if (snapshot.exists()) return snapshot.val();

    await set(matchRef, match);
    return match;
  } catch (error) {
    console.warn(`Firebase could not seed ${matchId}.`, error);
    return null;
  }
}

export async function listFirebaseMatches() {
  const { database, ref, get } = await loadFirebase();
  const snapshot = await get(ref(database, MATCHES_ROOT));
  return snapshot.exists() ? (snapshot.val() || {}) : {};
}

export async function subscribeFirebaseMatches(onMatches, onError) {
  try {
    const { database, ref, onValue } = await loadFirebase();

    return onValue(
      ref(database, MATCHES_ROOT),
      (snapshot) => onMatches(snapshot.exists() ? (snapshot.val() || {}) : {}),
      (error) => {
        console.warn("Firebase match collection subscription failed.", error);
        onError?.(error);
      }
    );
  } catch (error) {
    console.warn("Firebase match collection subscription could not start.", error);
    onError?.(error);
    return () => {};
  }
}

export async function deleteFirebaseMatch(matchId) {
  const { database, ref, get, set } = await loadFirebase();
  const matchRef = ref(database, `${MATCHES_ROOT}/${matchId}`);

  await set(matchRef, null);
  const verified = await get(matchRef);
  if (verified.exists()) {
    throw new Error(`Firebase did not delete match ${matchId}.`);
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Legacy internal-store migration.                                         */
/* New ITB matches never use internalMatches again.                          */
/* -------------------------------------------------------------------------- */

async function readLegacyInternalMatch(matchId) {
  const response = await fetch(
    firebaseRestUrl(`${LEGACY_INTERNAL_ROOT}/${encodeURIComponent(matchId)}`),
    { method: "GET", cache: "no-store", headers: { Accept: "application/json" } }
  );

  if (!response.ok) {
    throw new Error(`Firebase legacy REST GET failed (${response.status})`);
  }

  return response.json();
}

async function writeLegacyInternalMatch(matchId, match) {
  const response = await fetch(
    firebaseRestUrl(`${LEGACY_INTERNAL_ROOT}/${encodeURIComponent(matchId)}`),
    {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(match)
    }
  );

  if (!response.ok) {
    throw new Error(`Firebase legacy REST PUT failed (${response.status})`);
  }

  return response.json();
}

export async function migrateLegacyInternalMatch(matchId) {
  if (!String(matchId).startsWith(LEGACY_INTERNAL_PREFIX)) return null;

  const { database, ref, get, set } = await loadFirebase();
  const targetRef = ref(database, `${MATCHES_ROOT}/${matchId}`);
  const current = await get(targetRef);

  if (current.exists()) return current.val();

  const legacy = await readLegacyInternalMatch(matchId);
  if (legacy == null) return null;

  await set(targetRef, legacy);
  const verified = await get(targetRef);
  if (!verified.exists()) {
    throw new Error(`Firebase migration did not persist match ${matchId}.`);
  }

  return verified.val();
}

export async function migrateLegacyInternalMatches() {
  let legacy = {};

  try {
    const response = await fetch(
      firebaseRestUrl(LEGACY_INTERNAL_ROOT),
      { method: "GET", cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`Firebase legacy REST GET failed (${response.status})`);
    legacy = (await response.json()) || {};
  } catch (error) {
    console.warn("Legacy internal-match migration lookup failed.", error);
    return {};
  }

  const migrated = {};
  for (const [id, match] of Object.entries(legacy)) {
    if (!String(id).startsWith(LEGACY_INTERNAL_PREFIX) || match == null) continue;

    try {
      const existing = await migrateLegacyInternalMatch(id);
      if (existing) migrated[id] = existing;
    } catch (error) {
      console.warn(`Could not migrate legacy internal match ${id}.`, error);
    }
  }

  return migrated;
}

/* -------------------------------------------------------------------------- */
/* Compatibility exports for code from older ITB builds.                    */
/* These names now point to matches/{id}, not internalMatches/{id}.           */
/* -------------------------------------------------------------------------- */

export async function subscribeFirebaseInternalMatch(matchId, onMatch, onError) {
  try {
    await migrateLegacyInternalMatch(matchId);
  } catch (error) {
    console.warn(`Legacy internal match migration skipped for ${matchId}.`, error);
  }

  return subscribeFirebaseMatch(matchId, onMatch, onError);
}

export function writeFirebaseInternalMatch(matchId, match) {
  return writeFirebaseMatch(matchId, match);
}

export async function seedFirebaseInternalMatch(matchId, match) {
  try {
    const migrated = await migrateLegacyInternalMatch(matchId);
    if (migrated) return migrated;
  } catch (error) {
    console.warn(`Legacy internal match migration skipped for ${matchId}.`, error);
  }

  return seedFirebaseMatch(matchId, match);
}

export async function getFirebaseInternalMatch(matchId) {
  const { database, ref, get } = await loadFirebase();
  const targetRef = ref(database, `${MATCHES_ROOT}/${matchId}`);
  const snapshot = await get(targetRef);

  if (snapshot.exists()) return snapshot.val();

  try {
    return await migrateLegacyInternalMatch(matchId);
  } catch (error) {
    console.warn(`Legacy internal match fallback failed for ${matchId}.`, error);
    return null;
  }
}

export async function listFirebaseInternalMatches() {
  const all = await listFirebaseMatches();

  try {
    const migrated = await migrateLegacyInternalMatches();
    return {
      ...Object.fromEntries(
        Object.entries(all).filter(([id]) => isInternalMatchRecord(id))
      ),
      ...migrated
    };
  } catch (error) {
    console.warn("Legacy internal-match migration could not complete.", error);
    return Object.fromEntries(
      Object.entries(all).filter(([id]) => isInternalMatchRecord(id))
    );
  }
}

export async function subscribeFirebaseInternalMatches(onMatches, onError) {
  try {
    await migrateLegacyInternalMatches();
  } catch (error) {
    console.warn("Legacy internal-match collection migration skipped.", error);
  }

  return subscribeFirebaseMatches(
    (all) => {
      onMatches(
        Object.fromEntries(
          Object.entries(all || {}).filter(([id]) => isInternalMatchRecord(id))
        )
      );
    },
    onError
  );
}

export async function deleteFirebaseInternalMatch(matchId) {
  await deleteFirebaseMatch(matchId);

  // Remove the deprecated record as well so a deleted ITB match can never be
  // resurrected by the legacy migration fallback.
  try {
    const response = await fetch(
      firebaseRestUrl(`${LEGACY_INTERNAL_ROOT}/${encodeURIComponent(matchId)}`),
      { method: "DELETE", cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!response.ok) {
      throw new Error(`Firebase legacy REST DELETE failed (${response.status})`);
    }
  } catch (error) {
    console.warn(`Could not remove legacy internal record for ${matchId}.`, error);
  }

  return true;
}

export async function writeFirebaseInternalPlayerStats(stats) {
  const { database, ref, set } = await loadFirebase();
  await set(ref(database, "internalPlayerStats"), stats);
}
