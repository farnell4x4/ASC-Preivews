import type { EditorState } from "@/lib/types";

const DATABASE_NAME = "asc-screenshot-maker";
const DATABASE_VERSION = 2;
const SESSION_STORE_NAME = "editorSessions";
const META_STORE_NAME = "editorMeta";
const ACTIVE_SESSION_KEY = "activeSessionId";
const LOADED_SESSION_IDS_KEY = "loadedSessionIds";

export const DEFAULT_SESSION_ID = "default";

export type PersistedEditorSession = {
  state: EditorState;
  previewZoom: number;
};

export type SavedEditorSessionSummary = {
  id: string;
  displayName: string;
  previewUrl: string | null;
  updatedAt: number;
  state: EditorState;
};

type SessionRecord = PersistedEditorSession & {
  id: string;
  displayName?: string;
  updatedAt?: number;
};

type MetaRecord = {
  key: string;
  value: string;
};

export function getFileSessionId(file: File) {
  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

export function getDefaultSessionName() {
  return "Current draft";
}

export async function loadEditorSession(sessionId: string) {
  const database = await openDatabase();

  return new Promise<PersistedEditorSession | null>((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE_NAME, "readonly");
    const store = transaction.objectStore(SESSION_STORE_NAME);
    const request = store.get(sessionId);

    request.onsuccess = () => {
      const record = request.result as SessionRecord | undefined;
      resolve(record ? { state: record.state, previewZoom: record.previewZoom } : null);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to load editor session."));
    };
  });
}

export async function saveEditorSession(sessionId: string, session: PersistedEditorSession) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SESSION_STORE_NAME);
    const request = store.put({
      id: sessionId,
      state: session.state,
      previewZoom: session.previewZoom,
      displayName: getSessionDisplayName(sessionId, session.state.uploadedScreenshotUrl),
      updatedAt: Date.now(),
    } satisfies SessionRecord);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(request.error ?? new Error("Unable to save editor session."));
    };
  });
}

export async function listSavedEditorSessions() {
  const database = await openDatabase();

  return new Promise<SavedEditorSessionSummary[]>((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE_NAME, "readonly");
    const store = transaction.objectStore(SESSION_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result as SessionRecord[])
        .filter((record) => record.id !== DEFAULT_SESSION_ID && record.state.uploadedScreenshotUrl)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .map((record) => ({
          id: record.id,
          displayName: record.displayName ?? "Saved file",
          previewUrl: record.state.uploadedScreenshotUrl,
          updatedAt: record.updatedAt ?? 0,
          state: record.state,
        }));

      resolve(records);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to list saved editor sessions."));
    };
  });
}

export async function loadActiveSessionId() {
  const database = await openDatabase();

  return new Promise<string | null>((resolve, reject) => {
    const transaction = database.transaction(META_STORE_NAME, "readonly");
    const store = transaction.objectStore(META_STORE_NAME);
    const request = store.get(ACTIVE_SESSION_KEY);

    request.onsuccess = () => {
      const record = request.result as MetaRecord | undefined;
      resolve(record?.value ?? null);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to load active editor session."));
    };
  });
}

export async function saveActiveSessionId(sessionId: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(META_STORE_NAME, "readwrite");
    const store = transaction.objectStore(META_STORE_NAME);
    const request = store.put({
      key: ACTIVE_SESSION_KEY,
      value: sessionId,
    } satisfies MetaRecord);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(request.error ?? new Error("Unable to save active editor session."));
    };
  });
}

export async function loadLoadedSessionIds() {
  const database = await openDatabase();

  return new Promise<string[]>((resolve, reject) => {
    const transaction = database.transaction(META_STORE_NAME, "readonly");
    const store = transaction.objectStore(META_STORE_NAME);
    const request = store.get(LOADED_SESSION_IDS_KEY);

    request.onsuccess = () => {
      const record = request.result as MetaRecord | undefined;

      if (!record?.value) {
        resolve([]);
        return;
      }

      try {
        const parsed = JSON.parse(record.value);
        resolve(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
      } catch {
        resolve([]);
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to load editor canvas order."));
    };
  });
}

export async function saveLoadedSessionIds(sessionIds: string[]) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(META_STORE_NAME, "readwrite");
    const store = transaction.objectStore(META_STORE_NAME);
    const request = store.put({
      key: LOADED_SESSION_IDS_KEY,
      value: JSON.stringify(sessionIds),
    } satisfies MetaRecord);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(request.error ?? new Error("Unable to save editor canvas order."));
    };
  });
}

export async function deleteEditorSession(sessionId: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([SESSION_STORE_NAME, META_STORE_NAME], "readwrite");
    const sessionStore = transaction.objectStore(SESSION_STORE_NAME);
    const metaStore = transaction.objectStore(META_STORE_NAME);

    sessionStore.delete(sessionId);
    metaStore.get(ACTIVE_SESSION_KEY).onsuccess = (event) => {
      const record = (event.target as IDBRequest<MetaRecord | undefined>).result;

      if (record?.value === sessionId) {
        metaStore.put({
          key: ACTIVE_SESSION_KEY,
          value: DEFAULT_SESSION_ID,
        } satisfies MetaRecord);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("Unable to delete editor session."));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("Unable to delete editor session."));
    };
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SESSION_STORE_NAME)) {
        database.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(META_STORE_NAME)) {
        database.createObjectStore(META_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to open editor session database."));
    };
  });
}

function getSessionDisplayName(sessionId: string, screenshotUrl: string | null) {
  if (sessionId === DEFAULT_SESSION_ID) {
    return getDefaultSessionName();
  }

  const prefix = "file:";

  if (!sessionId.startsWith(prefix)) {
    return "Saved file";
  }

  const remainder = sessionId.slice(prefix.length);
  const sizeSeparator = remainder.lastIndexOf(":");

  if (sizeSeparator === -1) {
    return screenshotUrl ? "Saved file" : "Untitled file";
  }

  const withoutTimestamp = remainder.slice(0, sizeSeparator);
  const nameSeparator = withoutTimestamp.lastIndexOf(":");

  if (nameSeparator === -1) {
    return withoutTimestamp || "Saved file";
  }

  return withoutTimestamp.slice(0, nameSeparator) || "Saved file";
}
