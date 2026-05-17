const KEY = "suspect:sessionId";

export function getOrCreateSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function resetSessionId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}

const PROFILE_KEY = "suspect:profile";
export interface SavedProfile {
  name: string;
  emoji: string;
}

export function loadProfile(): SavedProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProfile;
  } catch {
    return null;
  }
}

export function saveProfile(p: SavedProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}
