const STORAGE_KEY = "suspect.gate.v1";

export function expectedPassword(): string {
  return (import.meta.env.VITE_APP_PASSWORD as string | undefined) ?? "";
}

export function getStoredPassword(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredPassword(pw: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, pw);
  } catch {
    /* ignore */
  }
}

export function clearStoredPassword(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
