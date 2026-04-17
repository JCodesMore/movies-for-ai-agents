#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getClient, hydrateMovie, hydrateList } from './lib/tmdb.js';
import { resolveGenreIds, getGenres } from './lib/genres.js';
import {
  getPreferences, setPreferences,
  getWatched, addWatched, removeWatched,
  getWatchlist, addWatchlist, removeWatchlist
} from './lib/state.js';
import { setConfig, getApiKey } from './lib/config.js';
import { paths } from './lib/paths.js';

const server = new McpServer({
  name: 'claude-for-movies',
  version: '0.1.0'
});

const asJson = (obj) => ({
  content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }]
});

const asError = (err) => ({
  isError: true,
  content: [{ type: 'text', text: `Error: ${err?.message ?? String(err)}` }]
});

const safe = async (fn) => {
  try { return await fn(); } catch (err) { return asError(err); }
};

// ---------- TMDB-facing tools ----------

server.registerTool(
  'movies_search',
  {
    title: 'Search movies',
    description: 'Search TMDB for movies by title or keyword. Returns up to 20 results with rich metadata (poster URL, year, overview, rating, genres, TMDB ID).',
    inputSchema: {
      query: z.string().describe('Title or keyword to search for'),
      year: z.number().int().optional().describe('Restrict to this release year'),
      language: z.string().optional().describe('ISO 639-1 language code (default: en-US)'),
      page: z.number().int().min(1).optional()
    }
  },
  ({ query, year, language, page }) => safe(async () => {
    const client = await getClient();
    const result = await client.searchMovie({ query, year, language, page });
    return asJson({
      page: result.page,
      totalPages: result.total_pages,
      totalResults: result.total_results,
      results: await hydrateList(result.results?.slice(0, 20))
    });
  })
);

server.registerTool(
  'movies_discover',
  {
    title: 'Discover movies by filters',
    description: 'Filter-based movie discovery: genres, release-year range, rating floor, runtime bounds, sort order. Great for mood/constraint queries like "a 2020s thriller under 2 hours with rating >= 7".',
    inputSchema: {
      genres: z.array(z.union([z.string(), z.number()])).optional().describe('Genre names or TMDB genre IDs (e.g., ["Thriller","Science Fiction"])'),
      excludeGenres: z.array(z.union([z.string(), z.number()])).optional(),
      yearFrom: z.number().int().optional().describe('Release year >= this'),
      yearTo: z.number().int().optional().describe('Release year <= this'),
      minRating: z.number().optional().describe('vote_average.gte (0-10)'),
      minVotes: z.number().int().optional().describe('vote_count.gte (trust floor, e.g. 100)'),
      maxRuntime: z.number().int().optional().describe('with_runtime.lte (minutes)'),
      minRuntime: z.number().int().optional().describe('with_runtime.gte (minutes)'),
      originalLanguage: z.string().optional().describe('ISO 639-1 code, e.g. "en", "ja"'),
      sortBy: z.enum([
        'popularity.desc','popularity.asc',
        'vote_average.desc','vote_average.asc',
        'primary_release_date.desc','primary_release_date.asc',
        'revenue.desc'
      ]).optional(),
      page: z.number().int().min(1).optional()
    }
  },
  (args) => safe(async () => {
    const client = await getClient();
    const params = {};
    if (args.genres?.length) params.with_genres = (await resolveGenreIds(args.genres)).join(',');
    if (args.excludeGenres?.length) params.without_genres = (await resolveGenreIds(args.excludeGenres)).join(',');
    if (args.yearFrom) params['primary_release_date.gte'] = `${args.yearFrom}-01-01`;
    if (args.yearTo) params['primary_release_date.lte'] = `${args.yearTo}-12-31`;
    if (args.minRating != null) params['vote_average.gte'] = args.minRating;
    if (args.minVotes != null) params['vote_count.gte'] = args.minVotes;
    if (args.maxRuntime != null) params['with_runtime.lte'] = args.maxRuntime;
    if (args.minRuntime != null) params['with_runtime.gte'] = args.minRuntime;
    if (args.originalLanguage) params.with_original_language = args.originalLanguage;
    if (args.sortBy) params.sort_by = args.sortBy;
    if (args.page) params.page = args.page;
    const result = await client.discoverMovie(params);
    return asJson({
      filtersApplied: params,
      page: result.page,
      totalPages: result.total_pages,
      totalResults: result.total_results,
      results: await hydrateList(result.results?.slice(0, 20))
    });
  })
);

server.registerTool(
  'movies_trending',
  {
    title: 'Trending movies',
    description: 'Movies trending on TMDB today or this week. Defaults to "week".',
    inputSchema: {
      window: z.enum(['day', 'week']).optional().describe('Time window (default: week)')
    }
  },
  ({ window }) => safe(async () => {
    const client = await getClient();
    const w = window ?? 'week';
    const result = await client.trending({ media_type: 'movie', time_window: w });
    return asJson({ window: w, results: await hydrateList(result.results?.slice(0, 20)) });
  })
);

server.registerTool(
  'movies_popular',
  {
    title: 'Popular movies',
    description: 'Currently popular movies on TMDB.',
    inputSchema: { page: z.number().int().min(1).optional() }
  },
  ({ page }) => safe(async () => {
    const client = await getClient();
    const result = await client.moviePopular({ page });
    return asJson({ page: result.page, results: await hydrateList(result.results?.slice(0, 20)) });
  })
);

server.registerTool(
  'movies_now_playing',
  {
    title: 'Now playing in theaters',
    description: 'Movies currently playing in theaters. Optional region code for locality.',
    inputSchema: {
      region: z.string().optional().describe('ISO 3166-1 region code, e.g. "US"'),
      page: z.number().int().min(1).optional()
    }
  },
  ({ region, page }) => safe(async () => {
    const client = await getClient();
    const result = await client.movieNowPlaying({ region, page });
    return asJson({ page: result.page, region, results: await hydrateList(result.results?.slice(0, 20)) });
  })
);

server.registerTool(
  'movies_recommendations',
  {
    title: 'Similar movies (TMDB recommendations)',
    description: 'Get movies TMDB recommends based on a seed movie ID. Use after the user says "I loved X, what else should I try?". Returns up to 20 hydrated results.',
    inputSchema: {
      movieId: z.number().int().describe('TMDB movie ID to seed recommendations from'),
      page: z.number().int().min(1).optional()
    }
  },
  ({ movieId, page }) => safe(async () => {
    const client = await getClient();
    const result = await client.movieRecommendations({ id: movieId, page });
    return asJson({ seedId: movieId, page: result.page, results: await hydrateList(result.results?.slice(0, 20)) });
  })
);

server.registerTool(
  'movies_details',
  {
    title: 'Full movie details',
    description: 'Full details for a single movie: runtime, genres, tagline, cast (when append=credits), trailers (videos), release dates, streaming providers.',
    inputSchema: {
      movieId: z.number().int().describe('TMDB movie ID'),
      append: z.array(z.enum([
        'credits','keywords','videos','release_dates','similar','recommendations','reviews','watch/providers'
      ])).optional().describe('Extra data to attach')
    }
  },
  ({ movieId, append }) => safe(async () => {
    const client = await getClient();
    const details = await client.movieInfo({
      id: movieId,
      append_to_response: append?.join(',')
    });
    const hydrated = await hydrateMovie(details);
    return asJson({
      ...hydrated,
      tagline: details.tagline,
      budget: details.budget,
      revenue: details.revenue,
      status: details.status,
      homepage: details.homepage,
      imdbId: details.imdb_id,
      productionCompanies: details.production_companies?.map(p => p.name),
      ...(details.credits && { credits: details.credits }),
      ...(details.keywords && { keywords: details.keywords }),
      ...(details.videos && { videos: details.videos }),
      ...(details.release_dates && { releaseDates: details.release_dates }),
      ...(details['watch/providers'] && { watchProviders: details['watch/providers'] })
    });
  })
);

server.registerTool(
  'movies_genres',
  {
    title: 'List TMDB genres',
    description: 'Return the list of TMDB genre names and IDs. Useful for mapping mood/vibe language to genre filters.',
    inputSchema: {}
  },
  () => safe(async () => asJson({ genres: await getGenres() }))
);

// ---------- Watched-list tools ----------

server.registerTool(
  'watched_add',
  {
    title: 'Log a watched movie',
    description: 'Record that the user has watched a movie. CALL THIS whenever the user mentions having watched, seen, finished, loved, or hated a movie (even in passing), so their history stays current. Captures optional rating (1-5) and notes; back-fills title/year/genres from TMDB.',
    inputSchema: {
      movieId: z.number().int().describe('TMDB movie ID (look up via movies_search first if you only have a title)'),
      rating: z.number().min(1).max(5).optional().describe('User rating 1-5 (5 = loved, 1 = hated)'),
      notes: z.string().optional().describe("User's reaction, quote, or why they liked/disliked it"),
      watchedAt: z.string().optional().describe('ISO date of when they watched it (default: now)')
    }
  },
  ({ movieId, rating, notes, watchedAt }) => safe(async () => {
    const client = await getClient();
    const details = await client.movieInfo({ id: movieId });
    const entry = {
      movieId,
      title: details.title,
      year: details.release_date ? details.release_date.slice(0, 4) : null,
      genres: details.genres?.map(g => g.name) ?? [],
      rating: rating ?? null,
      notes: notes ?? null,
      watchedAt: watchedAt ?? new Date().toISOString()
    };
    const list = await addWatched(entry);
    return asJson({ saved: entry, totalWatched: list.length });
  })
);

server.registerTool(
  'watched_list',
  {
    title: 'List watched movies',
    description: "The user's viewing history. Sorted most-recent-first by default. Use to avoid recommending movies they've already seen.",
    inputSchema: {
      limit: z.number().int().min(1).optional(),
      sortBy: z.enum(['watchedAt', 'rating', 'title']).optional()
    }
  },
  ({ limit, sortBy }) => safe(async () => {
    const list = await getWatched();
    const key = sortBy ?? 'watchedAt';
    const sorted = [...list].sort((a, b) => {
      if (key === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (key === 'title') return String(a.title).localeCompare(String(b.title));
      return String(b.watchedAt ?? '').localeCompare(String(a.watchedAt ?? ''));
    });
    return asJson({
      total: list.length,
      returned: limit ? Math.min(limit, sorted.length) : sorted.length,
      items: limit ? sorted.slice(0, limit) : sorted
    });
  })
);

server.registerTool(
  'watched_remove',
  {
    title: 'Remove a watched entry',
    description: 'Remove a movie from watched history (e.g., logged in error).',
    inputSchema: { movieId: z.number().int() }
  },
  ({ movieId }) => safe(async () => {
    const list = await removeWatched(movieId);
    return asJson({ removed: movieId, totalWatched: list.length });
  })
);

// ---------- Watchlist tools ----------

server.registerTool(
  'watchlist_add',
  {
    title: 'Add to watchlist',
    description: "Add a movie the user wants to watch later. Call this when the user says \"save this for later\", \"add X to my watchlist\", or similar.",
    inputSchema: {
      movieId: z.number().int(),
      note: z.string().optional().describe('Why they want to see it (e.g., "recommended by Sam")')
    }
  },
  ({ movieId, note }) => safe(async () => {
    const client = await getClient();
    const details = await client.movieInfo({ id: movieId });
    const entry = {
      movieId,
      title: details.title,
      year: details.release_date ? details.release_date.slice(0, 4) : null,
      note: note ?? null
    };
    const list = await addWatchlist(entry);
    return asJson({ saved: entry, totalWatchlist: list.length });
  })
);

server.registerTool(
  'watchlist_list',
  {
    title: 'Show watchlist',
    description: 'Movies the user wants to watch.',
    inputSchema: { limit: z.number().int().min(1).optional() }
  },
  ({ limit }) => safe(async () => {
    const list = await getWatchlist();
    return asJson({ total: list.length, items: limit ? list.slice(0, limit) : list });
  })
);

server.registerTool(
  'watchlist_remove',
  {
    title: 'Remove from watchlist',
    description: 'Drop a movie from the watchlist.',
    inputSchema: { movieId: z.number().int() }
  },
  ({ movieId }) => safe(async () => {
    const list = await removeWatchlist(movieId);
    return asJson({ removed: movieId, totalWatchlist: list.length });
  })
);

// ---------- Preferences tools ----------

server.registerTool(
  'preferences_get',
  {
    title: 'Get taste preferences',
    description: "The user's stored taste profile: liked/disliked genres, favorite directors/actors, decade and runtime prefs, mood defaults. Read this before recommending so suggestions match their taste.",
    inputSchema: {}
  },
  () => safe(async () => asJson(await getPreferences()))
);

server.registerTool(
  'preferences_set',
  {
    title: 'Update taste preferences',
    description: "Merge a patch into the user's preferences. Arrays are UNIONED (new unique values appended), objects shallow-merged, scalars replaced. Call this when the user reveals taste signals (\"I love slow cinema\", \"I avoid horror\", \"anything by Villeneuve\").",
    inputSchema: {
      likedGenres: z.array(z.string()).optional(),
      dislikedGenres: z.array(z.string()).optional(),
      favoriteDirectors: z.array(z.string()).optional(),
      favoriteActors: z.array(z.string()).optional(),
      favoriteMovies: z.array(z.number().int()).optional().describe('TMDB IDs'),
      avoidKeywords: z.array(z.string()).optional(),
      decadePrefs: z.object({
        from: z.number().int().nullable().optional(),
        to: z.number().int().nullable().optional()
      }).optional(),
      runtimePrefs: z.object({
        minMin: z.number().int().nullable().optional(),
        maxMin: z.number().int().nullable().optional()
      }).optional(),
      moodDefaults: z.array(z.string()).optional()
    }
  },
  (patch) => safe(async () => asJson(await setPreferences(patch)))
);

// ---------- Config / setup tools ----------

server.registerTool(
  'config_set_api_key',
  {
    title: 'Save TMDB API key',
    description: 'Persist the TMDB API key to the user-global config (chmod 600). Called by the setup skill after the user provides their key. Performs a smoke-test call to verify the key works.',
    inputSchema: {
      apiKey: z.string().min(10).describe('TMDB v3 API key or v4 read access token')
    }
  },
  ({ apiKey }) => safe(async () => {
    await setConfig({ tmdbApiKey: apiKey });
    const client = await getClient();
    await client.configuration();
    return asJson({ ok: true, storedAt: paths.config });
  })
);

server.registerTool(
  'config_status',
  {
    title: 'Plugin status',
    description: 'Report whether the TMDB key is set, show the user-global data directory, and summarize how many watched / watchlist / preference items exist. Useful at session start and for the setup skill.',
    inputSchema: {}
  },
  () => safe(async () => {
    const key = await getApiKey();
    const [prefs, watched, watchlist] = await Promise.all([
      getPreferences(), getWatched(), getWatchlist()
    ]);
    return asJson({
      configured: !!key,
      apiKeySource: process.env.TMDB_API_KEY ? 'env' : (key ? 'config.json' : null),
      dataDir: paths.dataDir,
      counts: {
        watched: watched.length,
        watchlist: watchlist.length,
        likedGenres: prefs.likedGenres.length,
        dislikedGenres: prefs.dislikedGenres.length,
        favoriteDirectors: prefs.favoriteDirectors.length,
        favoriteMovies: prefs.favoriteMovies.length
      }
    });
  })
);

// ---------- Connect ----------

try {
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (err) {
  console.error('[claude-for-movies] MCP server failed to start:', err?.stack ?? err);
  process.exit(1);
}
