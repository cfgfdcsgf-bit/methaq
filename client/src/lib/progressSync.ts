import { isSyncableProgressKey } from "@shared/progress";

export type ProgressEntry = { v: string; t: number };
export type ProgressItems = Record<string, ProgressEntry>;

const META_KEY = "meethaq-progress-timestamps";
const OWNER_KEY = "meethaq-progress-local-owner";
const CACHE_PREFIX = "meethaq-progress-cache:";
const CHANGE_EVENT = "meethaq:local-progress-change";
const MAX_KEYS = 300;
const MAX_BYTES = 200_000;
let nativeSetItem: Storage["setItem"] | null = null;
let suppressObserver = false;

function storageAvailable() {
  try { return typeof window !== "undefined" && Boolean(window.localStorage); } catch { return false; }
}

function readMeta(): Record<string, number> {
  if (!storageAvailable()) return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(META_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key, t]) =>
      isSyncableProgressKey(key) && Number.isSafeInteger(t) && (t as number) >= 0,
    )) as Record<string, number>;
  } catch { return {}; }
}

function rawSet(key: string, value: string) {
  if (!storageAvailable()) return;
  (nativeSetItem ?? Storage.prototype.setItem).call(window.localStorage, key, value);
}

function writeMeta(meta: Record<string, number>) {
  try { rawSet(META_KEY, JSON.stringify(meta)); } catch {}
}

export function installProgressStorageObserver() {
  if (typeof window === "undefined" || typeof Storage === "undefined" || nativeSetItem) return;
  nativeSetItem = Storage.prototype.setItem;
  const original = nativeSetItem;
  try {
    Storage.prototype.setItem = function (key: string, value: string) {
      original.call(this, key, value);
      let local = false;
      try { local = this === window.localStorage; } catch {}
      if (suppressObserver || !local || !isSyncableProgressKey(key)) return;
      const meta = readMeta();
      meta[key] = Date.now();
      writeMeta(meta);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    };
  } catch { nativeSetItem = null; }
}

function currentItems(): ProgressItems {
  const items: ProgressItems = {};
  if (!storageAvailable()) return items;
  const meta = readMeta();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !isSyncableProgressKey(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) items[key] = { v: value, t: meta[key] ?? 0 };
    }
  } catch { return {}; }
  return items;
}

function boundedItems(items: ProgressItems): ProgressItems {
  const sorted = Object.entries(items)
    .filter(([key, entry]) => isSyncableProgressKey(key) && typeof entry.v === "string" && entry.v.length <= 50_000 && Number.isSafeInteger(entry.t) && entry.t >= 0)
    .sort((a, b) => b[1].t - a[1].t);
  const result: ProgressItems = {};
  let bytes = 0;
  for (const [key, entry] of sorted) {
    const size = new TextEncoder().encode(entry.v).byteLength;
    if (Object.keys(result).length >= MAX_KEYS || bytes + size > MAX_BYTES) continue;
    result[key] = entry;
    bytes += size;
  }
  return result;
}

function validCache(value: unknown): { items: ProgressItems; meta: Record<string, number> } | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { items?: unknown; meta?: unknown };
  if (!data.items || typeof data.items !== "object" || Array.isArray(data.items)) return null;
  const items: ProgressItems = {};
  for (const [key, entry] of Object.entries(data.items as Record<string, unknown>)) {
    if (!isSyncableProgressKey(key) || !entry || typeof entry !== "object") continue;
    const candidate = entry as { v?: unknown; t?: unknown };
    if (typeof candidate.v === "string" && candidate.v.length <= 50_000 && Number.isSafeInteger(candidate.t) && (candidate.t as number) >= 0) {
      items[key] = { v: candidate.v, t: candidate.t as number };
    }
  }
  const meta = data.meta && typeof data.meta === "object" && !Array.isArray(data.meta)
    ? Object.fromEntries(Object.entries(data.meta as Record<string, unknown>).filter(([key, t]) => isSyncableProgressKey(key) && Number.isSafeInteger(t) && (t as number) >= 0)) as Record<string, number>
    : {};
  return { items: boundedItems(items), meta };
}

/** Switches the shared localStorage progress keys to a user-specific cache before syncing. */
export function activateProgressAccount(userId: number | null): boolean {
  if (!storageAvailable() || (userId !== null && (!Number.isSafeInteger(userId) || userId <= 0))) return false;
  const account = userId === null ? "guest" : String(userId);
  let owner: string | null = null;
  try { owner = window.localStorage.getItem(OWNER_KEY); } catch { return false; }
  if (!owner) {
    if (userId === null) return false;
    try { rawSet(OWNER_KEY, account); } catch { throw new Error("Could not persist progress account scope"); }
    return false; // Existing guest progress is adopted by the first signed-in account.
  }
  if (owner === account) return false;

  const previousItems = boundedItems(currentItems());
  const previousMeta = readMeta();
  try { rawSet(CACHE_PREFIX + owner, JSON.stringify({ items: previousItems, meta: previousMeta })); }
  catch { throw new Error("Could not preserve the previous account's local progress"); }
  suppressObserver = true;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && isSyncableProgressKey(key)) window.localStorage.removeItem(key);
    }
    rawSet(META_KEY, "{}");
    rawSet(OWNER_KEY, account);
    let cache: unknown = null;
    try { cache = JSON.parse(window.localStorage.getItem(CACHE_PREFIX + account) ?? "null"); } catch {}
    const restored = validCache(cache);
    if (restored) {
      for (const [key, entry] of Object.entries(restored.items)) rawSet(key, entry.v);
      writeMeta(restored.meta);
    }
  } finally { suppressObserver = false; }
  return true;
}

export function readProgressSnapshot(): ProgressItems {
  return boundedItems(currentItems());
}

/** Applies newer remote values; on equal timestamps the server's merged value is canonical. */
export function applyMergedProgress(remote: unknown): boolean {
  if (!storageAvailable() || !remote || typeof remote !== "object" || Array.isArray(remote)) return false;
  const meta = readMeta();
  let changed = false;
  suppressObserver = true;
  try {
    for (const [key, raw] of Object.entries(remote as Record<string, unknown>)) {
      if (!isSyncableProgressKey(key) || !raw || typeof raw !== "object") continue;
      const entry = raw as { v?: unknown; t?: unknown };
      if (typeof entry.v !== "string" || entry.v.length > 50_000 || !Number.isSafeInteger(entry.t) || (entry.t as number) < 0 || (entry.t as number) > Date.now() + 5 * 60 * 1000) continue;
      let local: string | null = null;
      try { local = window.localStorage.getItem(key); } catch { continue; }
      if (local === null || (entry.t as number) >= (meta[key] ?? 0)) {
        try {
          if (local !== entry.v) {
            rawSet(key, entry.v);
            changed = true;
          }
          meta[key] = entry.t as number;
        } catch {}
      }
    }
    writeMeta(meta);
  } finally { suppressObserver = false; }
  return changed;
}

export { CHANGE_EVENT as PROGRESS_CHANGE_EVENT };
