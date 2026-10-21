/** Lokale opslag op het toestel. Alles in try/catch: privévensters en previews kunnen opslag blokkeren. */
const PREFIX = 'ufa:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? ({ ...fallbackShape(fallback), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function fallbackShape<T>(f: T): object {
  return f && typeof f === 'object' && !Array.isArray(f) ? (f as object) : {};
}

export function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Opslag niet beschikbaar: de app werkt gewoon door, alleen zonder geheugen.
  }
}

export function clearAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* niets */
  }
}
