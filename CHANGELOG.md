# Changelog

All notable changes to **claude-for-movies** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] — 2026-04-17

### Fixed
- `recommend` skill was rendering bare TMDB URLs (`themoviedb.org/movie/...`) and `TMDB X.X` ratings instead of the intended IMDb hyperlinks and IMDb ratings. Two compounding causes: (1) the per-strategy enrichment step pointed at `movies_imdb_batch_rating`, which can't backfill `imdbId` from a TMDB ID — so picks reached the renderer with no IMDb data; (2) the format spec only authorized "plain bold" as a fallback but didn't explicitly forbid TMDB URLs, leaving room for the model to invent one. Strategies A, C, D now require per-pick `movies_details({ movieId })` (which hydrates `imdbId` + IMDb rating in one round-trip), and the format contract explicitly forbids any `themoviedb.org/...` URL in user-facing output — plain bold `**Title**` is the only acceptable degraded state.
- `discover-movies` and `find-movie` had the same latent risk; tightened the format contract symmetrically.

## [0.2.0] — 2026-04-17

### Added
- **Custom named lists.** Organize picks into themed collections (`halloween`, `date-night`, `comfort-rewatches`, anything you want). Eight new MCP tools: `lists_names`, `lists_get_all`, `list_list`, `list_add`, `list_remove`, `list_rename`, `list_delete`. Lists auto-create on first add. The reserved name `watchlist` always exists and backs the legacy `watchlist_*` tools.
- **Active viewing state.** When you say *"I'll watch X tonight"* the plugin tracks the pickup. Next time you ask for a recommendation (>24h later), Claude leads with a one-line catch-up prompt and routes your reply into `watched.json` with a rating. Three new MCP tools: `active_add`, `active_list`, `active_remove`, plus `active_touch_asked` for "still watching" replies.
- **IMDb-hyperlinked titles** in all suggestion output. `recommend`, `find-movie`, and `discover-movies` now render picks as `**[Title](https://www.imdb.com/title/{imdbId}/)**` when the IMDb ID is available; plain bold otherwise.
- Skill guidance for proactive follow-up ("did you finish X?") with five-option rating capture (loved / okay / didn't love / still watching / dropped).

### Changed
- **Tool count: 24 → 35.** All new tools live alongside the existing 24; nothing was removed.
- `watchlist_*` tools now delegate to the generic `list_*` primitives — behavior unchanged for callers.
- Legacy `~/.claude/data/claude-for-movies/watchlist.json` migrates to `lists.json` automatically on first read; the legacy file is deleted post-migration.
- `setup` skill mentions custom lists + active viewing during onboarding.

## [0.1.3] — 2026-04-17

### Changed
- Skill guidance (`recommend`, `find-movie`, `discover-movies`) now defaults to IMDb rating only in output. TMDB score is a fallback when IMDb data is unavailable, or shown on explicit user request. Previously both were dual-listed (`IMDb 8.2 · TMDB 7.9`) which was visually noisy.

## [0.1.2] — 2026-04-17

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

## [0.1.1] — 2026-04-17

### Fixed
- Plugin install: MCP server failed to start with `ERR_MODULE_NOT_FOUND` because Claude Code's plugin installer runs `npm install` at the repo root, but the package manifest was nested under `mcp-server/`. Added a root `package.json` so runtime dependencies are installed where Node's module resolution will find them.

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

[Unreleased]: https://github.com/JCodesMore/claude-for-movies/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/JCodesMore/claude-for-movies/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JCodesMore/claude-for-movies/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/JCodesMore/claude-for-movies/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JCodesMore/claude-for-movies/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JCodesMore/claude-for-movies/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JCodesMore/claude-for-movies/releases/tag/v0.1.0
