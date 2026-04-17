import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { paths, ensureDataDir } from './paths.js';

const BASE = 'https://api.imdbapi.dev';
const TIMEOUT_MS = 3000;
const BATCH_SIZE = 5;
const MAX_CACHE_BYTES = 5 * 1024 * 1024;

const TTL = {
  details: 24 * 60 * 60 * 1000,
  discovery: 6 * 60 * 60 * 1000,
  interests: 7 * 24 * 60 * 60 * 1000
};

const memCache = new Map();
let diskCache = null;
let diskCacheLoaded = false;
let diskWriteQueue = Promise.resolve();
let disabled = process.env.IMDB_DISABLE === '1';

async function loadDiskCache() {
  if (diskCacheLoaded) return diskCache;
  diskCacheLoaded = true;
  try {
    const raw = await fs.readFile(paths.imdbCache, 'utf8');
    diskCache = JSON.parse(raw);
    if (!diskCache || typeof diskCache !== 'object') diskCache = {};
  } catch {
    diskCache = {};
  }
  return diskCache;
}

function persistDiskCache() {
  diskWriteQueue = diskWriteQueue.then(async () => {
    try {
      await ensureDataDir();
      let payload = JSON.stringify(diskCache);
      if (payload.length > MAX_CACHE_BYTES) {
        const entries = Object.entries(diskCache)
          .sort((a, b) => (a[1]?.savedAt ?? 0) - (b[1]?.savedAt ?? 0));
        while (payload.length > MAX_CACHE_BYTES && entries.length) {
          const [oldKey] = entries.shift();
          delete diskCache[oldKey];
          payload = JSON.stringify(diskCache);
        }
      }
      await fs.writeFile(paths.imdbCache, payload, 'utf8');
    } catch (err) {
      process.stderr.write(`[claude-for-movies] imdb cache write failed: ${err.message}\n`);
    }
  });
  return diskWriteQueue;
}

async function cacheGet(key, ttl) {
  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && now - mem.savedAt < ttl) return mem.value;
  const disk = await loadDiskCache();
  const hit = disk[key];
  if (hit && now - (hit.savedAt ?? 0) < ttl) {
    memCache.set(key, hit);
    return hit.value;
  }
  return undefined;
}

async function cachePut(key, value) {
  const entry = { savedAt: Date.now(), value };
  memCache.set(key, entry);
  const disk = await loadDiskCache();
  disk[key] = entry;
  persistDiskCache();
}

function hashFilters(obj) {
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify(obj));
  return h.digest('hex').slice(0, 16);
}

function buildQuery(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v != null) qs.append(key, String(v));
    } else {
      qs.append(key, String(value));
    }
  }
  return qs.toString();
}

async function request(path, params) {
  if (disabled) throw new Error('imdbapi.dev disabled via IMDB_DISABLE=1');
  const qs = buildQuery(params);
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`imdbapi.dev ${res.status} for ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function isDisabled() { return disabled; }

export async function searchTitles(query, limit = 10) {
  const key = `search:${query}:${limit}`;
  const cached = await cacheGet(key, TTL.discovery);
  if (cached) return cached;
  const data = await request('/search/titles', { query, limit });
  const titles = (data.titles ?? data.results ?? []).map(hydrateImdbTitle);
  await cachePut(key, titles);
  return titles;
}

export async function getTitle(imdbId) {
  const key = `title:${imdbId}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}`);
  const hydrated = hydrateImdbTitle(data);
  await cachePut(key, hydrated);
  return hydrated;
}

export async function batchGetTitles(imdbIds) {
  if (!imdbIds?.length) return [];
  const chunks = [];
  for (let i = 0; i < imdbIds.length; i += BATCH_SIZE) {
    chunks.push(imdbIds.slice(i, i + BATCH_SIZE));
  }
  const all = [];
  for (const chunk of chunks) {
    const key = `batch:${chunk.join(',')}`;
    let titles = await cacheGet(key, TTL.details);
    if (!titles) {
      const data = await request('/titles:batchGet', { titleIds: chunk });
      titles = (data.titles ?? []).map(hydrateImdbTitle);
      await cachePut(key, titles);
    }
    all.push(...titles);
  }
  return all;
}

export async function listTitles(filters = {}) {
  const params = {};
  if (filters.types?.length) params.types = filters.types;
  if (filters.genres?.length) params.genres = filters.genres;
  if (filters.countryCodes?.length) params.countryCodes = filters.countryCodes;
  if (filters.languageCodes?.length) params.languageCodes = filters.languageCodes;
  if (filters.nameIds?.length) params.nameIds = filters.nameIds;
  if (filters.interestIds?.length) params.interestIds = filters.interestIds;
  if (filters.startYear != null) params.startYear = filters.startYear;
  if (filters.endYear != null) params.endYear = filters.endYear;
  if (filters.minVoteCount != null) params.minVoteCount = filters.minVoteCount;
  if (filters.maxVoteCount != null) params.maxVoteCount = filters.maxVoteCount;
  if (filters.minAggregateRating != null) params.minAggregateRating = filters.minAggregateRating;
  if (filters.maxAggregateRating != null) params.maxAggregateRating = filters.maxAggregateRating;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortOrder) params.sortOrder = filters.sortOrder;
  if (filters.limit != null) params.limit = filters.limit;
  if (filters.pageToken) params.pageToken = filters.pageToken;

  const key = `list:${hashFilters(params)}`;
  const cached = await cacheGet(key, TTL.discovery);
  if (cached) return cached;
  const data = await request('/titles', params);
  const result = {
    titles: (data.titles ?? []).map(hydrateImdbTitle),
    nextPageToken: data.nextPageToken ?? null
  };
  await cachePut(key, result);
  return result;
}

export async function getCredits(imdbId, options = {}) {
  const params = {};
  if (options.categories?.length) params.categories = options.categories;
  if (options.pageSize) params.pageSize = options.pageSize;
  if (options.pageToken) params.pageToken = options.pageToken;
  const key = `credits:${imdbId}:${hashFilters(params)}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/credits`, params);
  await cachePut(key, data);
  return data;
}

export async function getVideos(imdbId, options = {}) {
  const params = {};
  if (options.types?.length) params.types = options.types;
  if (options.pageSize) params.pageSize = options.pageSize;
  if (options.pageToken) params.pageToken = options.pageToken;
  const key = `videos:${imdbId}:${hashFilters(params)}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/videos`, params);
  await cachePut(key, data);
  return data;
}

export async function getAwards(imdbId, options = {}) {
  const params = {};
  if (options.pageSize) params.pageSize = options.pageSize;
  if (options.pageToken) params.pageToken = options.pageToken;
  const key = `awards:${imdbId}:${hashFilters(params)}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/awardNominations`, params);
  await cachePut(key, data);
  return data;
}

export async function getBoxOffice(imdbId) {
  const key = `box:${imdbId}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/boxOffice`);
  await cachePut(key, data);
  return data;
}

export async function getParentsGuide(imdbId) {
  const key = `pg:${imdbId}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/parentsGuide`);
  await cachePut(key, data);
  return data;
}

export async function getCertificates(imdbId) {
  const key = `cert:${imdbId}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/certificates`);
  await cachePut(key, data);
  return data;
}

export async function getReleaseDates(imdbId, options = {}) {
  const params = {};
  if (options.pageSize) params.pageSize = options.pageSize;
  if (options.pageToken) params.pageToken = options.pageToken;
  const key = `rel:${imdbId}:${hashFilters(params)}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/releaseDates`, params);
  await cachePut(key, data);
  return data;
}

export async function getAkas(imdbId) {
  const key = `aka:${imdbId}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/titles/${imdbId}/akas`);
  await cachePut(key, data);
  return data;
}

export async function listInterests({ refresh = false } = {}) {
  if (!refresh) {
    try {
      const raw = await fs.readFile(paths.interestsCache, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Date.now() - (parsed.savedAt ?? 0) < TTL.interests) {
        return parsed.interests;
      }
    } catch { /* ignore, fetch fresh */ }
  }
  const data = await request('/interests');
  const interests = data.interests ?? data.results ?? [];
  try {
    await ensureDataDir();
    await fs.writeFile(
      paths.interestsCache,
      JSON.stringify({ savedAt: Date.now(), interests }),
      'utf8'
    );
  } catch (err) {
    process.stderr.write(`[claude-for-movies] interests cache write failed: ${err.message}\n`);
  }
  return interests;
}

export async function getInterest(interestId) {
  const key = `interest:${interestId}`;
  const cached = await cacheGet(key, TTL.interests);
  if (cached) return cached;
  const data = await request(`/interests/${interestId}`);
  await cachePut(key, data);
  return data;
}

export async function getFilmography(nameId, options = {}) {
  const params = {};
  if (options.categories?.length) params.categories = options.categories;
  if (options.pageSize) params.pageSize = options.pageSize;
  if (options.pageToken) params.pageToken = options.pageToken;
  const key = `film:${nameId}:${hashFilters(params)}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/names/${nameId}/filmography`, params);
  await cachePut(key, data);
  return data;
}

export async function getName(nameId) {
  const key = `name:${nameId}`;
  const cached = await cacheGet(key, TTL.details);
  if (cached) return cached;
  const data = await request(`/names/${nameId}`);
  await cachePut(key, data);
  return data;
}

export async function batchGetNames(nameIds) {
  if (!nameIds?.length) return [];
  const chunks = [];
  for (let i = 0; i < nameIds.length; i += BATCH_SIZE) {
    chunks.push(nameIds.slice(i, i + BATCH_SIZE));
  }
  const all = [];
  for (const chunk of chunks) {
    const key = `nameBatch:${chunk.join(',')}`;
    let names = await cacheGet(key, TTL.details);
    if (!names) {
      const data = await request('/names:batchGet', { nameIds: chunk });
      names = data.names ?? [];
      await cachePut(key, names);
    }
    all.push(...names);
  }
  return all;
}

export function hydrateImdbTitle(title) {
  if (!title) return null;
  const rating = title.rating ?? {};
  const meta = title.metacritic ?? {};
  const primary = title.primaryImage ?? {};
  return {
    imdbId: title.id,
    type: title.type,
    title: title.primaryTitle,
    originalTitle: title.originalTitle,
    year: title.startYear ?? null,
    endYear: title.endYear ?? null,
    runtimeMinutes: title.runtimeSeconds != null ? Math.round(title.runtimeSeconds / 60) : null,
    genres: title.genres ?? [],
    posterUrl: primary.url ?? null,
    posterWidth: primary.width ?? null,
    posterHeight: primary.height ?? null,
    imdbRating: rating.aggregateRating ?? null,
    imdbVotes: rating.voteCount ?? null,
    metascore: meta.metascore ?? null,
    plot: title.plot ?? null,
    interestTags: (title.interests ?? []).map(i => ({ id: i.id, name: i.name })),
    directors: (title.directors ?? []).map(n => ({ id: n.id, name: n.displayName ?? n.name })),
    writers: (title.writers ?? []).map(n => ({ id: n.id, name: n.displayName ?? n.name })),
    stars: (title.stars ?? []).map(n => ({ id: n.id, name: n.displayName ?? n.name })),
    originCountries: (title.originCountries ?? []).map(c => ({ code: c.code, name: c.name })),
    spokenLanguages: (title.spokenLanguages ?? []).map(l => ({ code: l.code, name: l.name })),
    imdbUrl: title.id ? `https://www.imdb.com/title/${title.id}/` : null
  };
}

export async function findNameCandidates(query, limit = 3) {
  const titles = await searchTitles(query, 5);
  const nameHits = new Map();
  const q = query.toLowerCase();
  for (const t of titles) {
    for (const group of [t.directors, t.writers, t.stars]) {
      for (const n of group ?? []) {
        if (!n?.id) continue;
        if (n.name && n.name.toLowerCase().includes(q)) {
          if (!nameHits.has(n.id)) nameHits.set(n.id, { ...n, titleHits: [] });
          nameHits.get(n.id).titleHits.push(t.title);
        }
      }
    }
  }
  if (nameHits.size < limit) {
    for (const t of titles.slice(0, 2)) {
      try {
        const credits = await getCredits(t.imdbId, { pageSize: 30 });
        for (const c of credits.credits ?? credits.results ?? []) {
          const person = c.name ?? {};
          if (!person.id) continue;
          const personName = person.displayName ?? person.name ?? '';
          if (personName.toLowerCase().includes(q) && !nameHits.has(person.id)) {
            nameHits.set(person.id, {
              id: person.id,
              name: personName,
              titleHits: [t.title]
            });
          }
        }
      } catch { /* continue */ }
    }
  }
  return Array.from(nameHits.values()).slice(0, limit);
}
