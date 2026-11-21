import { DEFAULT_REMINDERS, type ReminderPrefs } from "@shared/reminders";
import type { PrayerCity } from "@shared/prayer";

const prefsKey = "meethaq-reminder-prefs";
const accessKey = "meethaq-reminder-device";
type Access = { endpoint: string; token: string };
function access(): Access | null {
  try { return JSON.parse(localStorage.getItem(accessKey) ?? "null"); } catch { return null; }
}
export function readReminderPrefs(): ReminderPrefs {
  try { return JSON.parse(localStorage.getItem(prefsKey) ?? "null") ?? DEFAULT_REMINDERS; }
  catch { return DEFAULT_REMINDERS; }
}
export const remindersEnabled = () => "Notification" in window && Notification.permission === "granted" && Boolean(access());
export const supportsPush = () => window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function request(path: string, method: string, body: unknown) {
  const result = await fetch("/api/reminders/" + path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!result.ok) throw new Error("reminder " + result.status);
  return result;
}
export async function reminderConfig() {
  const result = await fetch("/api/reminders/config", { cache: "no-store" });
  if (!result.ok) return { available: false };
  return result.json() as Promise<{ available: boolean; publicKey?: string }>;
}
function ready(): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("worker timeout")), 8000);
    void navigator.serviceWorker.ready.then(reg => { clearTimeout(timeout); resolve(reg); }, reject);
  });
}
function decodePublicKey(key: string) {
  return Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
}
async function saveDevice(prefs: ReminderPrefs, city: PrayerCity, subscription: PushSubscription) {
  const current = access();
  const exactLocationNeeded = Object.values(prefs.prayers).some(mode => mode !== "off") || prefs.ramadan;
  const result = await request("device", "PUT", {
    subscription: subscription.toJSON(), prefs,
    city: { ...city, lat: exactLocationNeeded ? city.lat : 0, lng: exactLocationNeeded ? city.lng : 0,
      tz: city.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone },
    token: current?.endpoint === subscription.endpoint ? current.token : undefined,
  });
  const { token } = await result.json();
  localStorage.setItem(accessKey, JSON.stringify({ endpoint: subscription.endpoint, token }));
  localStorage.setItem(prefsKey, JSON.stringify(prefs));
}
export async function enableReminders(prefs: ReminderPrefs, city: PrayerCity, publicKey: string) {
  if (!supportsPush() || await Notification.requestPermission() !== "granted") throw new Error("permission");
  const registration = await ready();
  let current = await registration.pushManager.getSubscription();
  const key = decodePublicKey(publicKey);
  const actualKey = current?.options.applicationServerKey;
  if (current && actualKey && new Uint8Array(actualKey).some((value, i) => value !== key[i])) {
    await current.unsubscribe();
    current = null;
  }
  const subscription = current ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try { await saveDevice(prefs, city, subscription); }
  catch (error) { if (!current) await subscription.unsubscribe().catch(() => false); throw error; }
}
export async function disableReminders() {
  const current = access();
  // Unsubscribe first so the device stops receiving alerts even if the network is down.
  if (supportsPush()) {
    const registration = await ready();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  }
  if (current) await request("device", "DELETE", current);
  localStorage.removeItem(accessKey);
}
let locationVersion = 0;
let locationSync = Promise.resolve();
export function syncReminderLocation(city: PrayerCity) {
  if (!remindersEnabled()) return Promise.resolve();
  const version = ++locationVersion;
  locationSync = locationSync.catch(() => {}).then(async () => {
    if (version !== locationVersion || !remindersEnabled()) return;
    const registration = await ready();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await saveDevice(readReminderPrefs(), city, subscription);
  }).catch(() => {
    window.dispatchEvent(new Event("reminder-sync-failed"));
  });
  return locationSync;
}
export function sendTestReminder() {
  const current = access();
  if (!current) throw new Error("device");
  return request("test", "POST", current);
}
