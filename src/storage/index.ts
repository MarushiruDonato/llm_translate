import { AppSettings, HistoryEntry, Profile } from '../types';
import { DEFAULT_SETTINGS, INITIAL_PROFILES, MAX_HISTORY_ITEMS } from '../utils/constants';

const KEYS = {
  SETTINGS: 'app_settings',
  PROFILES: 'app_profiles',
  HISTORY: 'app_history',
};

// In-memory fallback for testing environments where chrome.storage is not available
const memoryStorage = new Map<string, any>();

async function getStorageItem<T>(key: string, defaultValue: T): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  }
  return memoryStorage.has(key) ? memoryStorage.get(key) : defaultValue;
}

async function setStorageItem<T>(key: string, value: T): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  memoryStorage.set(key, value);
}

// --- App Settings ---

export async function getSettings(): Promise<AppSettings> {
  const settings = await getStorageItem<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await setStorageItem(KEYS.SETTINGS, updated);
  return updated;
}

// --- Profiles ---

export async function getProfiles(): Promise<Profile[]> {
  return getStorageItem<Profile[]>(KEYS.PROFILES, INITIAL_PROFILES);
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  await setStorageItem(KEYS.PROFILES, profiles);
}

export async function getProfileById(id: string): Promise<Profile | undefined> {
  const profiles = await getProfiles();
  return profiles.find((p) => p.id === id);
}

export async function upsertProfile(profile: Profile): Promise<Profile[]> {
  const profiles = await getProfiles();
  const index = profiles.findIndex((p) => p.id === profile.id);
  let updated: Profile[];
  if (index >= 0) {
    updated = [...profiles];
    updated[index] = profile;
  } else {
    updated = [...profiles, profile];
  }
  await saveProfiles(updated);
  return updated;
}

export async function deleteProfile(id: string): Promise<Profile[]> {
  const profiles = await getProfiles();
  const updated = profiles.filter((p) => p.id !== id);
  await saveProfiles(updated);
  return updated;
}

// --- History & Cache ---

export async function getHistory(): Promise<HistoryEntry[]> {
  return getStorageItem<HistoryEntry[]>(KEYS.HISTORY, []);
}

export async function addHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const history = await getHistory();
  // Filter out any existing entry with the same cacheKey so the new one goes to the front (LRU)
  const filtered = history.filter((h) => h.cacheKey !== entry.cacheKey);
  const updated = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  await setStorageItem(KEYS.HISTORY, updated);
  return updated;
}

export async function findHistoryByCacheKey(cacheKey: string): Promise<HistoryEntry | undefined> {
  const history = await getHistory();
  return history.find((h) => h.cacheKey === cacheKey);
}

export async function clearHistory(): Promise<void> {
  await setStorageItem(KEYS.HISTORY, []);
}

export async function deleteHistoryItem(id: string): Promise<HistoryEntry[]> {
  const history = await getHistory();
  const updated = history.filter((h) => h.id !== id);
  await setStorageItem(KEYS.HISTORY, updated);
  return updated;
}
