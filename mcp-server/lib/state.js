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

// ---------- Custom lists ----------

const RESERVED_WATCHLIST = 'watchlist';

export async function getLists() {
  const stored = await readJson(paths.lists, null);
  if (stored) return stored;

  const legacy = await readJson(paths.watchlist, null);
  if (legacy) {
    const seeded = { [RESERVED_WATCHLIST]: legacy };
    await writeJson(paths.lists, seeded);
    try { await fs.unlink(paths.watchlist); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    return seeded;
  }
  return {};
}

export async function getList(name) {
  const lists = await getLists();
  return lists[name] ?? [];
}

export async function addToList(name, entry) {
  const lists = await getLists();
  const cur = lists[name] ?? [];
  if (!cur.find(e => e.movieId === entry.movieId)) {
    cur.push({ ...entry, addedAt: new Date().toISOString() });
  }
  lists[name] = cur;
  await writeJson(paths.lists, lists);
  return cur;
}

export async function removeFromList(name, movieId) {
  const lists = await getLists();
  if (!(name in lists)) return [];
  lists[name] = lists[name].filter(e => e.movieId !== movieId);
  await writeJson(paths.lists, lists);
  return lists[name];
}

export async function renameList(oldName, newName) {
  if (oldName === RESERVED_WATCHLIST) {
    throw new Error(`Cannot rename the reserved "watchlist" list.`);
  }
  const lists = await getLists();
  if (!(oldName in lists)) throw new Error(`List "${oldName}" does not exist.`);
  if (newName in lists) throw new Error(`List "${newName}" already exists.`);
  lists[newName] = lists[oldName];
  delete lists[oldName];
  await writeJson(paths.lists, lists);
  return lists;
}

export async function deleteList(name) {
  if (name === RESERVED_WATCHLIST) {
    throw new Error(`Cannot delete the reserved "watchlist" list.`);
  }
  const lists = await getLists();
  if (!(name in lists)) return lists;
  delete lists[name];
  await writeJson(paths.lists, lists);
  return lists;
}

export async function listNames() {
  const lists = await getLists();
  const out = {};
  for (const [name, entries] of Object.entries(lists)) {
    out[name] = Array.isArray(entries) ? entries.length : 0;
  }
  return out;
}

// Legacy watchlist functions delegate to the list helpers.

export async function getWatchlist() {
  return getList(RESERVED_WATCHLIST);
}

export async function addWatchlist(entry) {
  return addToList(RESERVED_WATCHLIST, entry);
}

export async function removeWatchlist(movieId) {
  return removeFromList(RESERVED_WATCHLIST, movieId);
}

// ---------- Active viewing ----------

export async function getActive() {
  return readJson(paths.active, []);
}

export async function addActive(entry) {
  const list = await getActive();
  if (list.find(e => e.movieId === entry.movieId)) return list;
  list.push({
    ...entry,
    source: entry.source ?? null,
    startedAt: new Date().toISOString(),
    lastAskedAt: null
  });
  await writeJson(paths.active, list);
  return list;
}

export async function removeActive(movieId) {
  const list = (await getActive()).filter(e => e.movieId !== movieId);
  await writeJson(paths.active, list);
  return list;
}

export async function touchActiveAsked(movieId) {
  const list = await getActive();
  const idx = list.findIndex(e => e.movieId === movieId);
  if (idx < 0) return list;
  list[idx] = { ...list[idx], lastAskedAt: new Date().toISOString() };
  await writeJson(paths.active, list);
  return list;
}
