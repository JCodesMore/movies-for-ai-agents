# Changelog

All notable changes to **claude-for-movies** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
