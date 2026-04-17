# TMDB (how this plugin uses it)

Accessed via `moviedb-promise` v4. Every call goes through `mcp-server/lib/tmdb.js`. Requires a free TMDB API key; user provides via `TMDB_API_KEY` env or `config_set_api_key` tool.

## Endpoints in use

| Helper | TMDB path | Purpose |
|---|---|---|
| `client.searchMovie` | `/search/movie` | Fuzzy title search |
| `client.discoverMovie` | `/discover/movie` | Filtered browse — genre, year, rating, votes, runtime, original-language, sort |
| `client.trending` | `/trending/movie/{window}` | Day- or week-window trending (momentum signal) |
| `client.moviePopular` | `/movie/popular` | Lifetime popularity |
| `client.movieNowPlaying` | `/movie/now_playing` | Currently in theaters |
| `client.movieRecommendations` | `/movie/{id}/recommendations` | ML "similar movies" — keep this, imdbapi.dev can't replace it |
| `client.movieInfo` | `/movie/{id}` with `append_to_response` | Full details; we append `credits,keywords,videos,release_dates,watch/providers` |
| `client.genreMovieList` | `/genre/movie/list` | Canonical TMDB genre list (id → name) |
| `client.configuration` | `/configuration` | Image base URL + available sizes (cached) |

## Normalized shape (via `hydrateMovie()`)

```
{
  id, title, originalTitle, year, releaseDate,
  overview, rating (vote_average), voteCount, popularity,
  genreIds[], genres[],
  runtime,
  posterUrl (w500), backdropUrl (w1280), tmdbUrl,

  // when movieInfo is called
  tagline, budget, revenue, status, homepage, imdbId,
  productionCompanies[],

  // when append_to_response flags are set
  credits, keywords, videos, releaseDates, watchProviders,

  // when imdbapi.dev enrichment applied (new)
  imdbRating, imdbVotes, metascore, imdbInterestTags[]
}
```

## What TMDB gives us that imdbapi.dev doesn't

- **Recommendations** — the flagship "similar movies" feature.
- **Watch providers** — streaming availability per country.
- **Trending** with day/week momentum windows.
- **Now playing** — actual in-theater titles.
- **Richer fuzzy search** — handles typos and partial matches better than IMDb's strict search.
- **Localized titles/overviews** — TMDB's `language` param returns localized fields.

## Key file paths

- Client wrapper: `mcp-server/lib/tmdb.js`
- Config/key handling: `mcp-server/lib/config.js`
- Tool registrations: `mcp-server/index.js`
