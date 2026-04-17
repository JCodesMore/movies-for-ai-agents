# Changelog

All notable changes to **claude-for-movies** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Hybrid data source: TMDB + [imdbapi.dev](https://api.imdbapi.dev) (no extra key required).
- Six new MCP tools powered by imdbapi.dev:
  - `movies_imdb_discover` — IMDb-rating-aware discovery with `minAggregateRating`, `maxVoteCount`, `interestIds`, `nameIds`, `countryCodes`, `languageCodes`, and IMDb-native sort orders.
  - `movies_imdb_search` — exact-title search that returns IMDb IDs natively.
  - `movies_imdb_details` — IMDb title details with optional sub-resources: `credits`, `videos`, `awards`, `boxOffice`, `parentsGuide`, `certificates`, `releaseDates`, `akas`.
  - `movies_imdb_batch_rating` — batched IMDb rating fetch (internally chunked to 5 per call).
  - `movies_imdb_find_name` — resolves a person name to candidate IMDb nameIds (searches titles + walks credits).
  - `movies_imdb_interests` — full IMDb interest taxonomy (~162 granular themes like Heist, Time Travel, Space Opera), cached locally for 7 days.
- `movies_details` now automatically enriches TMDB data with IMDb rating, vote count, Metascore, and interest tags.
- `movies_discover` accepts an optional `minImdbRating` that routes the query to imdbapi.dev for IMDb-rating-aware filtering.
- Preferences schema extended (backward-compatible) with optional `likedInterests`, `likedCountries`, `likedLanguages`.
- Reference docs at `docs/api-reference/imdbapi-dev.md` and `docs/api-reference/tmdb.md` for skills to consult when crafting fresh query patterns.
- Disk-backed response cache (`~/.claude/data/claude-for-movies/imdb-cache.json`) with 24h / 6h / 7d TTLs and 5 MB soft cap.
- `IMDB_DISABLE=1` env var to force imdbapi.dev offline if needed.

### Changed
- `movies_details` and `movies_discover` enriched in a non-breaking way — existing callers keep working.
- Skill guidance (`discover-movies`, `find-movie`, `recommend`, `movies-journal`, `setup`) updated to route between TMDB and imdbapi.dev per intent.

### Fixed
- Graceful fallback: any imdbapi.dev failure (timeout, non-2xx, network) is swallowed and logged to stderr; TMDB-only data is returned so the plugin never hard-fails if imdbapi.dev is down.

## [0.1.0] — 2026-04-17

### Added
- Initial public release.
- Five skills: `setup`, `find-movie`, `discover-movies`, `recommend`, `movies-journal`.
- Eighteen MCP tools across three groups:
  - **TMDB** (8) — `movies_search`, `movies_discover`, `movies_trending`, `movies_popular`, `movies_now_playing`, `movies_recommendations`, `movies_details`, `movies_genres`
  - **Local state** (8) — `watched_add`, `watched_list`, `watched_remove`, `watchlist_add`, `watchlist_list`, `watchlist_remove`, `preferences_get`, `preferences_set`
  - **Config** (2) — `config_set_api_key`, `config_status`
- User-global storage at `~/.claude/data/claude-for-movies/` — taste profile and watch history follow users across projects.
- TMDB integration via [moviedb-promise](https://github.com/grantholle/moviedb-promise).
- API key management: interactive `/claude-for-movies:setup`, or `TMDB_API_KEY` environment variable (env var takes precedence).
- `config.json` is created with `0600` permissions so the key is readable only by the owner.

[Unreleased]: https://github.com/JCodesMore/claude-for-movies/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JCodesMore/claude-for-movies/releases/tag/v0.1.0
