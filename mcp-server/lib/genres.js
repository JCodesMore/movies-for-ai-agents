import { getClient, getGenreCache, setGenreCache } from './tmdb.js';

export async function getGenres() {
  const cached = getGenreCache();
  if (cached) return cached;
  const client = await getClient();
  const result = await client.genreMovieList();
  setGenreCache(result.genres);
  return result.genres;
}

export async function resolveGenreIds(names) {
  if (!names?.length) return [];
  if (names.every(n => typeof n === 'number')) return names;
  const genres = await getGenres();
  const map = new Map(genres.map(g => [g.name.toLowerCase(), g.id]));
  return names
    .map(n => (typeof n === 'number' ? n : map.get(String(n).toLowerCase())))
    .filter(Boolean);
}
