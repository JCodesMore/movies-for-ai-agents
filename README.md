# claude-for-movies

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1400896964597383279?label=discord&logo=discord&logoColor=white)](https://discord.gg/babcVNJBet)
[![More plugins](https://img.shields.io/badge/more%20plugins-jcodesmore--plugins-black)](https://github.com/JCodesMore/jcodesmore-plugins)

> Your personal movie concierge, built into Claude Code. Powered by [TMDB](https://www.themoviedb.org/) — and, for IMDb ratings + richer discovery filters, [imdbapi.dev](https://api.imdbapi.dev) (no extra key needed).

Ask Claude *"what should I watch tonight?"* — it already knows what you've seen, remembers what you've loved, and picks accordingly. Mention a film in passing and it quietly logs it and learns your taste. Your profile follows you across every project, every machine.

## Demo

[![Watch the demo](https://img.youtube.com/vi/g4qwbu5H278/maxresdefault.jpg)](https://youtu.be/g4qwbu5H278)

## Install in 3 steps

**1. Get a free TMDB API key** — takes about 2 minutes:

- Go to https://www.themoviedb.org/settings/api
- Create an account, accept the developer terms, copy your **v3 API Key**.

**2. Install the plugin** — inside Claude Code, run:

```
/plugin marketplace add JCodesMore/jcodesmore-plugins
/plugin install claude-for-movies@jcodesmore-plugins
```

Then fully **restart Claude Code** (quit the app and reopen — not just `/exit`).

**3. Give the plugin your key** — in Claude Code, type:

```
/claude-for-movies:setup
```

Paste your TMDB key when prompted. Done — you're ready to go.

## Try it

Talk to Claude like a friend:

- *"What should I watch tonight?"*
- *"Find me that 90s movie about a hacker..."*
- *"I just finished Arrival, absolutely loved it."* — Claude silently logs it and learns your taste
- *"Something cerebral, under two hours."*
- *"Sci-fi with an IMDb rating of 8 or higher from the 2010s."*
- *"Best heist movies of all time."*
- *"Christopher Nolan's filmography."*
- *"Hidden gems — highly rated but obscure."*

The more you mention what you watch, the better the recommendations get.

## What's inside

Five skills that activate automatically based on what you say:

| Skill | Triggers when you... |
|---|---|
| `setup` | first run, or when your API key isn't configured |
| `find-movie` | ask *"find me that movie where..."* |
| `discover-movies` | ask *"what's popular / trending / new in theaters?"* |
| `recommend` | ask *"what should I watch?"* or describe a mood |
| `movies-journal` | mention watching / finishing / loving / hating a movie — auto-logs it |

**New in 0.2.0** — *custom named lists* (say *"add Weapons to my halloween list"* and Claude organizes picks by theme), *active viewing state* (when you say *"I'll watch X tonight"* Claude tracks it and asks how it went next time), and *IMDb-hyperlinked titles* in every suggestion.

Behind these skills, **35 MCP tools** expose TMDB search / recommendations / details, imdbapi.dev rating-aware discovery / interest filters / person lookup / awards / box office, custom named lists, active viewing, and your taste profile. Type `/mcp` inside Claude Code to inspect them live.

## Where your data lives

Everything stays on **your machine**, outside any one project folder:

```
~/.claude/data/claude-for-movies/
├── config.json           ← your TMDB API key (permissions 600)
├── preferences.json      ← your taste profile (liked genres, directors, interests, etc.)
├── watched.json          ← what you've seen
├── lists.json            ← every custom list, including the default "watchlist"
├── active.json           ← films you've started but not finished — drives follow-ups
├── imdb-cache.json       ← cached imdbapi.dev responses (24h/6h TTLs)
└── imdb-interests.json   ← cached IMDb interest taxonomy (7d TTL)
```

> Upgrading from 0.1.x? Your old `watchlist.json` migrates into `lists.json` automatically on first read.

Your taste follows you across every project and every machine that shares this directory. No telemetry, no analytics — nothing leaves your machine except TMDB search queries.

## Troubleshooting

| Something's off | Fix |
|---|---|
| *"TMDB API key not configured"* | Run `/claude-for-movies:setup` — or set `TMDB_API_KEY` in your shell environment. |
| Plugin doesn't show up in `/mcp` | Fully quit Claude Code and reopen. The plugin registers on startup. |
| *"Cannot find module '@modelcontextprotocol/sdk'"* | Only happens with manual install — run `cd mcp-server && npm install`. |
| Recommendations still feel generic | Tell Claude about 3–5 movies you love. Give it some signal to work with. |

More help in the [Discord](https://discord.gg/babcVNJBet).

## Community

- **Chat / help / show-and-tell:** [Discord](https://discord.gg/babcVNJBet)
- **Bugs & feature requests:** [GitHub issues](https://github.com/JCodesMore/claude-for-movies/issues)
- **Contribute:** see [CONTRIBUTING.md](CONTRIBUTING.md)
- **More plugins:** [`jcodesmore-plugins`](https://github.com/JCodesMore/jcodesmore-plugins)

## Advanced install (without the marketplace)

If you'd rather clone and run it directly:

```bash
git clone https://github.com/JCodesMore/claude-for-movies.git
cd claude-for-movies/mcp-server && npm install
cd ..
cc --plugin-dir .
```

Or skip `/claude-for-movies:setup` entirely by exporting your key as an environment variable:

```bash
export TMDB_API_KEY="your_key_here"
```

The environment variable takes precedence over `config.json` when both are set.

## Requirements

- Node.js ≥ 18
- A free [TMDB API key](https://www.themoviedb.org/settings/api) (v3)

## Built on

- [moviedb-promise](https://github.com/grantholle/moviedb-promise) — TMDB client
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) — tool exposure to Claude
- [TMDB](https://www.themoviedb.org/) — fuzzy search, trending, now-playing, ML recommendations, watch providers
- [imdbapi.dev](https://api.imdbapi.dev) — IMDb ratings, Metascore, interest taxonomy, rating-aware discovery, awards, box office (no key required)

## License

[Apache License 2.0](LICENSE) — © 2026 JCodesMore

> This product uses the TMDB API but is not endorsed or certified by TMDB.

---

*Part of [jcodesmore-plugins](https://github.com/JCodesMore/jcodesmore-plugins).*
