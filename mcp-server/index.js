#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getClient, hydrateMovie, hydrateList } from './lib/tmdb.js';
import { resolveGenreIds, getGenres } from './lib/genres.js';
import {
  getPreferences, setPreferences,
  getWatched, addWatched, removeWatched,
  getWatchlist, addWatchlist, removeWatchlist,
  getLists, getList, addToList, removeFromList,
  renameList, deleteList, listNames,
  getActive, addActive, removeActive, touchActiveAsked
} from './lib/state.js';
import { setConfig, getApiKey } from './lib/config.js';
import { paths } from './lib/paths.js';
import * as imdb from './lib/imdb.js';

const server = new McpServer({
  name: 'claude-for-movies',
  version: '0.2.0'
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

async function tryImdb(fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    process.stderr.write(`[claude-for-movies] imdbapi.dev enrichment skipped: ${err.message}\n`);
    return fallback;
  }
}

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
    description: 'Filter-based movie discovery: genres, release-year range, rating floor, runtime bounds, sort order. Great for mood/constraint queries like "a 2020s thriller under 2 hours with rating >= 7". If `minImdbRating` is supplied the query is routed to imdbapi.dev for IMDb-rating-aware discovery.',
    inputSchema: {
      genres: z.array(z.union([z.string(), z.number()])).optional().describe('Genre names or TMDB genre IDs (e.g., ["Thriller","Science Fiction"])'),
      excludeGenres: z.array(z.union([z.string(), z.number()])).optional(),
      yearFrom: z.number().int().optional().describe('Release year >= this'),
      yearTo: z.number().int().optional().describe('Release year <= this'),
      minRating: z.number().optional().describe('TMDB vote_average.gte (0-10)'),
      minImdbRating: z.number().optional().describe('IMDb aggregate rating floor (0-10). When set, routes via imdbapi.dev.'),
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
    if (args.minImdbRating != null) {
      const genreNames = (args.genres ?? []).filter(g => typeof g === 'string');
      const result = await imdb.listTitles({
        types: ['MOVIE'],
        genres: genreNames.length ? genreNames : undefined,
        startYear: args.yearFrom,
        endYear: args.yearTo,
        minAggregateRating: args.minImdbRating,
        minVoteCount: args.minVotes,
        languageCodes: args.originalLanguage ? [args.originalLanguage] : undefined,
        sortBy: 'SORT_BY_USER_RATING',
        sortOrder: 'DESC',
        limit: 20
      });
      return asJson({
        source: 'imdbapi.dev',
        filtersApplied: { ...args },
        results: result.titles,
        nextPageToken: result.nextPageToken
      });
    }
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
      source: 'tmdb',
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
    description: 'Full details for a single movie: runtime, genres, tagline, cast (when append=credits), trailers (videos), release dates, streaming providers. When the TMDB record has an IMDb ID, imdbapi.dev data (imdbRating, imdbVotes, metascore, imdbInterestTags) is merged automatically.',
    inputSchema: {
      movieId: z.number().int().describe('TMDB movie ID'),
      append: z.array(z.enum([
        'credits','keywords','videos','release_dates','similar','recommendations','reviews','watch/providers'
      ])).optional().describe('Extra TMDB data to attach'),
      includeAwards: z.boolean().optional().describe('Also attach awardNominations from imdbapi.dev (slower)')
    }
  },
  ({ movieId, append, includeAwards }) => safe(async () => {
    const client = await getClient();
    const details = await client.movieInfo({
      id: movieId,
      append_to_response: append?.join(',')
    });
    const imdbId = details.imdb_id ?? null;
    const imdbData = imdbId ? await tryImdb(() => imdb.getTitle(imdbId)) : null;
    const hydrated = await hydrateMovie(details, imdbData ? {
      imdbId,
      imdbRating: imdbData.imdbRating,
      imdbVotes: imdbData.imdbVotes,
      metascore: imdbData.metascore,
      interestTags: imdbData.interestTags
    } : null);
    const awards = (imdbId && includeAwards)
      ? await tryImdb(() => imdb.getAwards(imdbId, { pageSize: 20 }))
      : null;
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
      ...(details['watch/providers'] && { watchProviders: details['watch/providers'] }),
      ...(awards && { awards })
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

// ---------- imdbapi.dev-facing tools ----------

server.registerTool(
  'movies_imdb_discover',
  {
    title: 'Discover movies via IMDb (rating-aware)',
    description: 'Canonical IMDb-rating-aware discovery against imdbapi.dev. Supports minAggregateRating, vote-count bands, interestIds (Heist, Time Travel, Space Opera, etc.), nameIds (director/actor filter), country/language filters, year range, and SORT_BY_USER_RATING / POPULARITY / RELEASE_DATE / YEAR / USER_RATING_COUNT. Prefer this over `movies_discover` whenever the user asks for an IMDb rating threshold, a filmography, a thematic subgenre, or hidden gems.',
    inputSchema: {
      types: z.array(z.enum(['MOVIE','TV_SERIES','TV_MINI_SERIES','TV_SPECIAL','TV_MOVIE','SHORT','VIDEO','VIDEO_GAME'])).optional(),
      genres: z.array(z.string()).optional().describe('IMDb genre names, e.g. ["Sci-Fi","Drama"]'),
      countryCodes: z.array(z.string()).optional().describe('ISO 3166-1 alpha-2, e.g. ["US","KR"]'),
      languageCodes: z.array(z.string()).optional().describe('ISO 639-1/2, e.g. ["ja","es"]'),
      nameIds: z.array(z.string()).optional().describe('IMDb person IDs (nm...)'),
      interestIds: z.array(z.string()).optional().describe('IMDb interest IDs (in...) for granular themes'),
      startYear: z.number().int().optional(),
      endYear: z.number().int().optional(),
      minVoteCount: z.number().int().optional(),
      maxVoteCount: z.number().int().optional(),
      minAggregateRating: z.number().optional().describe('0.0-10.0 IMDb rating floor'),
      maxAggregateRating: z.number().optional(),
      sortBy: z.enum([
        'SORT_BY_POPULARITY','SORT_BY_RELEASE_DATE','SORT_BY_USER_RATING',
        'SORT_BY_USER_RATING_COUNT','SORT_BY_YEAR'
      ]).optional(),
      sortOrder: z.enum(['ASC','DESC']).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      pageToken: z.string().optional()
    }
  },
  (args) => safe(async () => {
    const result = await imdb.listTitles({
      types: args.types ?? ['MOVIE'],
      ...args
    });
    return asJson({
      source: 'imdbapi.dev',
      filtersApplied: args,
      count: result.titles.length,
      results: result.titles,
      nextPageToken: result.nextPageToken
    });
  })
);

server.registerTool(
  'movies_imdb_search',
  {
    title: 'Search titles via IMDb',
    description: 'Exact/close title search against imdbapi.dev. Returns IMDb IDs natively. Prefer TMDB `movies_search` for fuzzy descriptions; use this when you need an IMDb ID to branch into other imdbapi.dev flows.',
    inputSchema: {
      query: z.string(),
      limit: z.number().int().min(1).max(50).optional()
    }
  },
  ({ query, limit }) => safe(async () => {
    const results = await imdb.searchTitles(query, limit ?? 10);
    return asJson({ source: 'imdbapi.dev', count: results.length, results });
  })
);

server.registerTool(
  'movies_imdb_details',
  {
    title: 'IMDb title details + optional sub-resources',
    description: 'Full title record from imdbapi.dev with selectable sub-resources. Includes IMDb rating, metascore, interest tags, directors/writers/stars, countries, languages. Use `include` to pull credits, videos, awards, boxOffice, parentsGuide, certificates, releaseDates, or akas.',
    inputSchema: {
      imdbId: z.string().describe('IMDb title ID (tt...)'),
      include: z.array(z.enum([
        'credits','videos','awards','boxOffice','parentsGuide','certificates','releaseDates','akas'
      ])).optional()
    }
  },
  ({ imdbId, include }) => safe(async () => {
    const base = await imdb.getTitle(imdbId);
    const out = { ...base };
    if (!include?.length) return asJson(out);
    const jobs = [];
    if (include.includes('credits')) jobs.push(['credits', imdb.getCredits(imdbId, { pageSize: 50 })]);
    if (include.includes('videos')) jobs.push(['videos', imdb.getVideos(imdbId, { pageSize: 20 })]);
    if (include.includes('awards')) jobs.push(['awards', imdb.getAwards(imdbId, { pageSize: 25 })]);
    if (include.includes('boxOffice')) jobs.push(['boxOffice', imdb.getBoxOffice(imdbId)]);
    if (include.includes('parentsGuide')) jobs.push(['parentsGuide', imdb.getParentsGuide(imdbId)]);
    if (include.includes('certificates')) jobs.push(['certificates', imdb.getCertificates(imdbId)]);
    if (include.includes('releaseDates')) jobs.push(['releaseDates', imdb.getReleaseDates(imdbId, { pageSize: 25 })]);
    if (include.includes('akas')) jobs.push(['akas', imdb.getAkas(imdbId)]);
    const settled = await Promise.allSettled(jobs.map(([, p]) => p));
    settled.forEach((outcome, i) => {
      const [key] = jobs[i];
      if (outcome.status === 'fulfilled') out[key] = outcome.value;
      else out[`${key}Error`] = outcome.reason?.message ?? String(outcome.reason);
    });
    return asJson(out);
  })
);

server.registerTool(
  'movies_imdb_batch_rating',
  {
    title: 'Batch IMDb ratings',
    description: 'Fetch IMDb rating, vote count, metascore, and interest tags for up to 50 IMDb IDs. Internally chunks to 5 per API call. Handy after a TMDB recommendations call to surface IMDb signal.',
    inputSchema: {
      imdbIds: z.array(z.string()).min(1).max(50)
    }
  },
  ({ imdbIds }) => safe(async () => {
    const results = await imdb.batchGetTitles(imdbIds);
    return asJson({ source: 'imdbapi.dev', count: results.length, results });
  })
);

server.registerTool(
  'movies_imdb_find_name',
  {
    title: 'Resolve a person name to IMDb nameIds',
    description: 'Given a free-text name (e.g. "Christopher Nolan"), returns up to 3 candidate IMDb nameIds. Search-by-title + credits traversal, since imdbapi.dev has no direct /search/names endpoint. Feed the resulting nameIds into `movies_imdb_discover`.',
    inputSchema: {
      query: z.string()
    }
  },
  ({ query }) => safe(async () => {
    const matches = await imdb.findNameCandidates(query, 3);
    return asJson({ query, count: matches.length, matches });
  })
);

server.registerTool(
  'movies_imdb_interests',
  {
    title: 'IMDb interest taxonomy',
    description: 'Full list of IMDb interest tags (~162 granular themes: Heist, Time Travel, Space Opera, Cyberpunk, Neo-Noir, etc.). Cached locally for 7 days. Use `refresh: true` to force a fresh pull.',
    inputSchema: {
      refresh: z.boolean().optional()
    }
  },
  ({ refresh }) => safe(async () => {
    const interests = await imdb.listInterests({ refresh: refresh === true });
    return asJson({ count: interests.length, interests });
  })
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
      imdbId: details.imdb_id ?? null,
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
      imdbId: details.imdb_id ?? null,
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
    description: "The user's stored taste profile: liked/disliked genres, favorite directors/actors, decade and runtime prefs, mood defaults, liked IMDb interests/countries/languages. Read this before recommending so suggestions match their taste.",
    inputSchema: {}
  },
  () => safe(async () => asJson(await getPreferences()))
);

server.registerTool(
  'preferences_set',
  {
    title: 'Update taste preferences',
    description: "Merge a patch into the user's preferences. Arrays are UNIONED (new unique values appended), objects shallow-merged, scalars replaced. Call this when the user reveals taste signals (\"I love slow cinema\", \"I avoid horror\", \"anything by Villeneuve\", \"more Korean films\"). `likedInterests` accepts IMDb interest names or IDs; `likedCountries`/`likedLanguages` accept ISO codes.",
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
      moodDefaults: z.array(z.string()).optional(),
      likedInterests: z.array(z.string()).optional().describe('IMDb interest names or IDs (in...)'),
      likedCountries: z.array(z.string()).optional().describe('ISO 3166-1 alpha-2 codes'),
      likedLanguages: z.array(z.string()).optional().describe('ISO 639-1/2 codes')
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
      imdbEnabled: !imdb.isDisabled(),
      dataDir: paths.dataDir,
      counts: {
        watched: watched.length,
        watchlist: watchlist.length,
        likedGenres: prefs.likedGenres.length,
        dislikedGenres: prefs.dislikedGenres.length,
        favoriteDirectors: prefs.favoriteDirectors.length,
        favoriteMovies: prefs.favoriteMovies.length,
        likedInterests: prefs.likedInterests?.length ?? 0,
        likedCountries: prefs.likedCountries?.length ?? 0,
        likedLanguages: prefs.likedLanguages?.length ?? 0
      }
    });
  })
);

// ---------- Custom list tools ----------

server.registerTool(
  'lists_names',
  {
    title: 'List custom-list names + counts',
    description: 'Returns a map of every custom list the user has created and how many entries it holds. Use to answer "show me my lists" or to confirm a list exists before adding to it.',
    inputSchema: {}
  },
  () => safe(async () => asJson({ names: await listNames() }))
);

server.registerTool(
  'lists_get_all',
  {
    title: 'Full contents of every custom list',
    description: 'Returns the entire `lists.json` map: { listName: [entries] }. Useful when you need a cross-list view before recommending or de-duplicating.',
    inputSchema: {}
  },
  () => safe(async () => asJson({ lists: await getLists() }))
);

server.registerTool(
  'list_list',
  {
    title: 'Show entries in one custom list',
    description: 'Return the entries of a single named list. Returns an empty array if the list does not exist (same shape as `watchlist_list`). The reserved name `watchlist` is the legacy default and is always available.',
    inputSchema: {
      listName: z.string().describe('Name of the list (e.g., "halloween", "date-night", "watchlist")'),
      limit: z.number().int().min(1).optional()
    }
  },
  ({ listName, limit }) => safe(async () => {
    const list = await getList(listName);
    return asJson({
      listName,
      total: list.length,
      items: limit ? list.slice(0, limit) : list
    });
  })
);

server.registerTool(
  'list_add',
  {
    title: 'Add a movie to a custom list',
    description: 'Add a movie to a named list, auto-creating the list if it does not exist. Hydrates the entry from TMDB (title, year, imdbId) so renderers can produce hyperlinked output. Call this when the user says "add X to my halloween list", "save X for date night", etc.',
    inputSchema: {
      listName: z.string().describe('Name of the list (auto-created if missing)'),
      movieId: z.number().int(),
      note: z.string().optional().describe('Optional context — why it belongs on this list')
    }
  },
  ({ listName, movieId, note }) => safe(async () => {
    const client = await getClient();
    const details = await client.movieInfo({ id: movieId });
    const imdbId = details.imdb_id ?? null;
    const imdbData = imdbId ? await tryImdb(() => imdb.getTitle(imdbId)) : null;
    const entry = {
      movieId,
      imdbId,
      title: details.title,
      year: details.release_date ? details.release_date.slice(0, 4) : null,
      imdbRating: imdbData?.imdbRating ?? null,
      note: note ?? null
    };
    const list = await addToList(listName, entry);
    return asJson({ listName, saved: entry, total: list.length });
  })
);

server.registerTool(
  'list_remove',
  {
    title: 'Remove a movie from a custom list',
    description: 'Drop a movie from a named list by movieId. Returns the updated list.',
    inputSchema: {
      listName: z.string(),
      movieId: z.number().int()
    }
  },
  ({ listName, movieId }) => safe(async () => {
    const list = await removeFromList(listName, movieId);
    return asJson({ listName, removed: movieId, total: list.length });
  })
);

server.registerTool(
  'list_rename',
  {
    title: 'Rename a custom list',
    description: 'Rename an existing list. Refuses to rename the reserved "watchlist" list (it backs the legacy `watchlist_*` tools). Refuses if the new name already exists.',
    inputSchema: {
      oldName: z.string(),
      newName: z.string()
    }
  },
  ({ oldName, newName }) => safe(async () => {
    await renameList(oldName, newName);
    return asJson({ ok: true, oldName, newName, names: await listNames() });
  })
);

server.registerTool(
  'list_delete',
  {
    title: 'Delete a custom list',
    description: 'Delete a custom list and all its entries. Refuses to delete the reserved "watchlist" list. Use when the user says "delete my halloween list" or "drop the date-night list".',
    inputSchema: { listName: z.string() }
  },
  ({ listName }) => safe(async () => {
    await deleteList(listName);
    return asJson({ ok: true, deleted: listName, names: await listNames() });
  })
);

// ---------- Active viewing tools ----------

server.registerTool(
  'active_add',
  {
    title: 'Mark a movie as actively being watched',
    description: 'Record that the user has started watching a movie but has not yet finished it. Call this when the user says "I\'ll watch X tonight", "starting X now", "going with X". The skill uses this to prompt for follow-up ("did you finish?") in a future session. Hydrates the entry from TMDB so future prompts can render the title with an IMDb hyperlink.',
    inputSchema: {
      movieId: z.number().int(),
      source: z.string().optional().describe('Where the pickup came from — e.g., "recommend", "discover", "manual"')
    }
  },
  ({ movieId, source }) => safe(async () => {
    const client = await getClient();
    const details = await client.movieInfo({ id: movieId });
    const imdbId = details.imdb_id ?? null;
    const entry = {
      movieId,
      imdbId,
      title: details.title,
      year: details.release_date ? details.release_date.slice(0, 4) : null,
      source: source ?? null
    };
    const list = await addActive(entry);
    return asJson({ saved: entry, total: list.length });
  })
);

server.registerTool(
  'active_list',
  {
    title: 'List actively-watching entries',
    description: 'Return entries the user has started but not finished. Each entry includes computed `ageHours` (since `startedAt`) and `askedHoursAgo` (since `lastAskedAt`, or null if never asked). The `recommend` skill uses these to decide whether to lead with a one-line catch-up prompt before new picks.',
    inputSchema: {}
  },
  () => safe(async () => {
    const list = await getActive();
    const now = Date.now();
    const items = list.map(e => {
      const startedMs = e.startedAt ? new Date(e.startedAt).getTime() : null;
      const askedMs = e.lastAskedAt ? new Date(e.lastAskedAt).getTime() : null;
      return {
        ...e,
        ageHours: startedMs != null ? (now - startedMs) / 3_600_000 : null,
        askedHoursAgo: askedMs != null ? (now - askedMs) / 3_600_000 : null
      };
    });
    return asJson({ total: items.length, items });
  })
);

server.registerTool(
  'active_remove',
  {
    title: 'Remove an actively-watching entry',
    description: 'Drop a movie from the active list — call after the user resolves it (finished, dropped, etc.). The watched-add tool does NOT auto-clear active state, so route both calls when applicable.',
    inputSchema: { movieId: z.number().int() }
  },
  ({ movieId }) => safe(async () => {
    const list = await removeActive(movieId);
    return asJson({ removed: movieId, total: list.length });
  })
);

server.registerTool(
  'active_touch_asked',
  {
    title: 'Mark an active entry as just-asked-about',
    description: 'Update `lastAskedAt` on an active entry to now. Call this when the user replies "still watching" to a follow-up prompt — prevents the skill from re-asking within 24h.',
    inputSchema: { movieId: z.number().int() }
  },
  ({ movieId }) => safe(async () => {
    const list = await touchActiveAsked(movieId);
    return asJson({ touched: movieId, total: list.length });
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
