# Security policy

## Supported versions

Only the latest minor version of `claude-for-movies` receives security updates.

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Where your data lives

All plugin state is stored **locally** in `~/.claude/data/claude-for-movies/`:

- `config.json` — your TMDB API key (created with `0600` permissions, readable only by you).
- `preferences.json` — your taste profile.
- `watched.json` — your viewing history.
- `watchlist.json` — your to-watch list.

**Nothing leaves your machine** except queries to the TMDB API (movie search, metadata, recommendations). There is no telemetry, no analytics, and no third-party network calls beyond TMDB.

## API key handling

- Your TMDB key is stored in `config.json` with file permissions set to `0600` at creation.
- The key is **never** logged, echoed to stdout, or included in error messages or stack traces.
- If you prefer environment variables, set `TMDB_API_KEY` in your shell — it takes precedence over `config.json` when both are set.
- Rotating your key: delete `config.json` (or unset `TMDB_API_KEY`) and run `/claude-for-movies:setup` again.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Instead:

- Open a private security advisory at https://github.com/JCodesMore/claude-for-movies/security/advisories/new, or
- Reach out in [Discord](https://discord.gg/babcVNJBet) to arrange a private channel.

You can expect an acknowledgement within 7 days and an update on triage within 14 days.

## Third-party dependencies

- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/sdk) — official MCP SDK (maintained by Anthropic).
- [`moviedb-promise`](https://github.com/grantholle/moviedb-promise) — TMDB client.
- [`zod`](https://github.com/colinhacks/zod) — input validation.

Dependency versions are pinned via `mcp-server/package-lock.json` and can be audited with `npm audit` from the `mcp-server/` directory.
