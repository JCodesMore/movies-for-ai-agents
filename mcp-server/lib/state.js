import fs from 'node:fs/promises';
import { paths, ensureDataDir } from './paths.js';

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, data) {
  await ensureDataDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const DEFAULT_PREFERENCES = {
  likedGenres: [],
  dislikedGenres: [],
  favoriteDirectors: [],
  favoriteActors: [],
  favoriteMovies: [],
  avoidKeywords: [],
  decadePrefs: { from: null, to: null },
  runtimePrefs: { minMin: null, maxMin: null },
  moodDefaults: [],
  likedInterests: [],
  likedCountries: [],
  likedLanguages: []
};

export async function getPreferences() {
  const stored = await readJson(paths.preferences, null);
  return { ...DEFAULT_PREFERENCES, ...(stored ?? {}) };
}

export async function setPreferences(patch) {
  const current = await getPreferences();
  const next = { ...current };
  for (const [key, val] of Object.entries(patch)) {
    if (val == null) continue;
    const cur = current[key];
    if (Array.isArray(cur) && Array.isArray(val)) {
      const seen = new Set(cur.map(v => JSON.stringify(v)));
      next[key] = [...cur];
      for (const item of val) {
        const marker = JSON.stringify(item);
        if (!seen.has(marker)) { next[key].push(item); seen.add(marker); }
      }
    } else if (cur && typeof cur === 'object' && !Array.isArray(cur) &&
               typeof val === 'object' && !Array.isArray(val)) {
      next[key] = { ...cur, ...val };
    } else {
      next[key] = val;
    }
  }
  await writeJson(paths.preferences, next);
  return next;
}

export async function getWatched() {
  return readJson(paths.watched, []);
}

export async function addWatched(entry) {
  const list = await getWatched();
  const idx = list.findIndex(e => e.movieId === entry.movieId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry, updatedAt: now };
  } else {
    list.push({ ...entry, loggedAt: now });
  }
  await writeJson(paths.watched, list);
  return list;
}

export async function removeWatched(movieId) {
  const list = (await getWatched()).filter(e => e.movieId !== movieId);
  await writeJson(paths.watched, list);
  return list;
}

export async function getWatchlist() {
  return readJson(paths.watchlist, []);
}

export async function addWatchlist(entry) {
  const list = await getWatchlist();
  if (!list.find(e => e.movieId === entry.movieId)) {
    list.push({ ...entry, addedAt: new Date().toISOString() });
  }
  await writeJson(paths.watchlist, list);
  return list;
}

export async function removeWatchlist(movieId) {
  const list = (await getWatchlist()).filter(e => e.movieId !== movieId);
  await writeJson(paths.watchlist, list);
  return list;
}
