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
  try {
    const { database, ref, onValue } = await loadFirebase();

    return onValue(
      ref(database, INTERNAL_ROOT),
      (snapshot) => {
        onMatches(
          snapshot.exists()
            ? (snapshot.val() || {})
            : {}
        );
      },
      (error) => {
        console.warn(
          "Firebase internal match list subscription failed.",
          error
        );
        onError?.(error);
      }
    );
  } catch (error) {
    console.warn(
      "Firebase internal match list subscription could not start.",
      error
    );
    onError?.(error);
    return () => {};
  }
}

function firebaseRestUrl(path) {
  return `${firebaseConfig.databaseURL}/${path}.json`;
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
  let timer = null;
  let lastSerialized = null;

  const emit = (value) => {
    if (!active || value == null) {
      return;
    }

    const serialized = JSON.stringify(value);

    if (serialized === lastSerialized) {
      return;
    }

    lastSerialized = serialized;
    onMatch(value);
  };

  try {
    const { database, ref, onValue } = await loadFirebase();

    sdkUnsubscribe = onValue(
      ref(database, `${INTERNAL_ROOT}/${matchId}`),
      (snapshot) => {
        emit(
          snapshot.exists()
            ? snapshot.val()
            : null
        );
      },
      (error) => {
        console.warn(
          `Firebase realtime subscription failed for ${matchId}; REST polling will continue.`,
          error
        );

        onError?.(error);
      }
    );
  } catch (error) {
    console.warn(
      `Firebase realtime subscription could not start for ${matchId}; REST polling will continue.`,
      error
    );

    onError?.(error);
  }

  const poll = async () => {
    if (!active) {
      return;
    }

    try {
      const remote =
        await readFirebaseInternalMatchRest(matchId);

      emit(remote);
    } catch (error) {
      onError?.(error);
    } finally {
      if (active) {
        timer = window.setTimeout(
          poll,
          1200
        );
      }
    }
  };

  void poll();

  return () => {
    active = false;

    sdkUnsubscribe?.();

    if (timer) {
      window.clearTimeout(timer);
    }
  };
}

export function writeFirebaseInternalMatch(matchId, match) {
  const previous =
    internalWriteQueues.get(matchId) ||
    Promise.resolve();

  const next = previous
    .catch(() => {})
    .then(async () => {
      try {
        const { database, ref, set } =
          await loadFirebase();

        await set(
          ref(
            database,
            `${INTERNAL_ROOT}/${matchId}`
          ),
          match
        );
      } catch (error) {
        console.warn(
          `Firebase SDK write failed for ${matchId}; trying REST write.`,
          error
        );

        await writeFirebaseInternalMatchRest(
          matchId,
          match
        );
      }
    });

  internalWriteQueues.set(
    matchId,
    next
  );

  void next.finally(() => {
    if (
      internalWriteQueues.get(matchId) === next
    ) {
      internalWriteQueues.delete(matchId);
    }
  });

  return next;
}

export async function seedFirebaseInternalMatch(
  matchId,
  match
) {
  const {
    database,
    ref,
    get,
    set
  } = await loadFirebase();

  const snapshot = await get(
    ref(
      database,
      `${INTERNAL_ROOT}/${matchId}`
    )
  );

  if (snapshot.exists()) {
    return snapshot.val();
  }

  await set(
    ref(
      database,
      `${INTERNAL_ROOT}/${matchId}`
    ),
    match
  );

  return match;
}

export async function getFirebaseInternalMatch(
  matchId
) {
  const {
    database,
    ref,
    get
  } = await loadFirebase();

  const snapshot = await get(
    ref(
      database,
      `${INTERNAL_ROOT}/${matchId}`
    )
  );

  return snapshot.exists()
    ? snapshot.val()
    : null;
}

export async function listFirebaseInternalMatches() {
  const {
    database,
    ref,
    get
  } = await loadFirebase();

  const snapshot = await get(
    ref(database, INTERNAL_ROOT)
  );

  return snapshot.exists()
    ? (snapshot.val() || {})
    : {};
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