import { MovieDb } from 'moviedb-promise';
import { getApiKey } from './config.js';

let cached = null;

export async function getClient() {
  const key = await getApiKey();
  if (!key) {
    throw new Error('TMDB API key not configured. Run the `setup` skill in Claude Code, or set TMDB_API_KEY.');
  }
  if (!cached || cached.key !== key) {
    cached = { key, client: new MovieDb(key), imageConfig: null, genres: null };
  }
  return cached.client;
}

async function getImageConfig() {
  if (cached?.imageConfig) return cached.imageConfig;
  const client = await getClient();
  const result = await client.configuration();
  cached.imageConfig = result.images;
  return cached.imageConfig;
}

function imageUrl(cfg, path, size) {
  return path ? `${cfg.secure_base_url}${size}${path}` : null;
}

export async function hydrateMovie(movie) {
  const cfg = await getImageConfig();
  return {
    id: movie.id,
    title: movie.title ?? movie.name,
    originalTitle: movie.original_title ?? movie.original_name,
    year: movie.release_date ? movie.release_date.slice(0, 4) : null,
    releaseDate: movie.release_date,
    overview: movie.overview,
    rating: movie.vote_average,
    voteCount: movie.vote_count,
    popularity: movie.popularity,
    genreIds: movie.genre_ids,
    genres: movie.genres?.map(g => g.name),
    runtime: movie.runtime,
    posterUrl: imageUrl(cfg, movie.poster_path, 'w500'),
    backdropUrl: imageUrl(cfg, movie.backdrop_path, 'w1280'),
    tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`
  };
}

export async function hydrateList(movies) {
  return Promise.all((movies ?? []).map(hydrateMovie));
}

export function getGenreCache() { return cached?.genres ?? null; }
export function setGenreCache(genres) { if (cached) cached.genres = genres; }
