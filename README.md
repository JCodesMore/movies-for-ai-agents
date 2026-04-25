<div align="center">

# Claude for Movies

### Your personal AI movie buddy

Ask *"what should I watch tonight?"* and get picks that actually fit your taste. Mention a film and Claude quietly logs it. The more you talk, the smarter it gets.

[![Discord](https://img.shields.io/badge/Join_the_community-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/babcVNJBet)

[Quick Start](#quick-start) · [Try it](#try-it) · [Discord](https://discord.gg/babcVNJBet) · [Demo](#demo)

</div>

---

## Demo

[![Watch the demo](https://img.youtube.com/vi/g4qwbu5H278/maxresdefault.jpg)](https://youtu.be/g4qwbu5H278)

> Click the image to watch the 60-second walkthrough.

## Quick Start

**1. Get a free TMDB API key** (~2 minutes) at https://www.themoviedb.org/settings/api — copy your **v3 key**.

**2. Install the plugin** — inside Claude Code, run:

```
/plugin marketplace add JCodesMore/jcodesmore-plugins
/plugin install claude-for-movies@jcodesmore-plugins
```

Then fully **restart Claude Code** (quit the app and reopen).

**3. Add your key** — run `/claude-for-movies:setup` and paste it when prompted. Done.

## Try it

Talk to Claude like a friend:

- *"What should I watch tonight?"*
- *"Find me that 90s movie about a hacker..."*
- *"I just finished Arrival, absolutely loved it."* — auto-logs it, learns your taste
- *"Something cerebral, under two hours."*
- *"Sci-fi with an IMDb rating of 8 or higher from the 2010s."*
- *"Hidden gems — highly rated but obscure."*

The more you mention what you watch, the better it gets.

## What's inside

**Five smart skills** that activate based on what you say · **35 MCP tools** for search, discovery, ratings, lists, and your taste profile · **Your taste follows you** across every project, every machine

| Skill | Triggers when you... |
|---|---|
| `setup` | first run, or when your API key isn't configured |
| `find-movie` | ask *"find me that movie where..."* |
| `discover-movies` | ask *"what's popular / trending / new in theaters?"* |
| `recommend` | ask *"what should I watch?"* or describe a mood |
| `movies-journal` | mention watching / finishing / loving / hating a movie — auto-logs it |

**New in 0.2.0** — *custom named lists* (say *"add Weapons to my halloween list"*), *active viewing state* (when you say *"I'll watch X tonight"* Claude tracks it and asks how it went next time), and *IMDb-hyperlinked titles* in every suggestion.

## Community

[**Discord**](https://discord.gg/babcVNJBet) — chat, help, show-and-tell · [**Issues**](https://github.com/JCodesMore/claude-for-movies/issues) — bugs & feature requests · [**Contribute**](CONTRIBUTING.md) · [**More plugins**](https://github.com/JCodesMore/jcodesmore-plugins)

<details>
<summary><b>Where your data lives</b></summary>

Everything stays on **your machine**, outside any one project folder:

```
~/.claude/data/claude-for-movies/
├── config.json           ← your TMDB API key (permissions 600)
├── preferences.json      ← your taste profile (liked genres, directors, interests, etc.)
├── watched.json          ← what you've seen
├── lists.json            ← every custom list, including the default "watchlist"
├── active.json           ← films you've started but not finished
├── imdb-cache.json       ← cached imdbapi.dev responses (24h/6h TTLs)
└── imdb-interests.json   ← cached IMDb interest taxonomy (7d TTL)
```

> Upgrading from 0.1.x? Your old `watchlist.json` migrates into `lists.json` automatically on first read.

Your taste follows you across every project and every machine that shares this directory. No telemetry, no analytics — nothing leaves your machine except TMDB search queries.

</details>

<details>
<summary><b>Troubleshooting</b></summary>

| Something's off | Fix |
|---|---|
| *"TMDB API key not configured"* | Run `/claude-for-movies:setup` — or set `TMDB_API_KEY` in your shell environment. |
| Plugin doesn't show up in `/mcp` | Fully quit Claude Code and reopen. The plugin registers on startup. |
| *"Cannot find module '@modelcontextprotocol/sdk'"* | Only happens with manual install — run `cd mcp-server && npm install`. |
| Recommendations still feel generic | Tell Claude about 3–5 movies you love. Give it some signal to work with. |

More help in the [Discord](https://discord.gg/babcVNJBet).

</details>

<details>
<summary><b>Advanced install (without the marketplace)</b></summary>

If you'd rather clone and run it directly:

```bash
git clone https://github.com/JCodesMore/claude-for-movies.git
cd claude-for-movies/mcp-server && npm install
cd ..
claude --plugin-dir .
```

Or skip `/claude-for-movies:setup` entirely by exporting your key as an environment variable:

```bash
export TMDB_API_KEY="your_key_here"
```

The environment variable takes precedence over `config.json` when both are set.

**Requirements:** Node.js ≥ 18, free [TMDB API key](https://www.themoviedb.org/settings/api).

</details>

<details>
<summary><b>Built on</b></summary>

- [moviedb-promise](https://github.com/grantholle/moviedb-promise) — TMDB client
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) — tool exposure to Claude
- [TMDB](https://www.themoviedb.org/) — fuzzy search, trending, now-playing, ML recommendations, watch providers
- [imdbapi.dev](https://api.imdbapi.dev) — IMDb ratings, Metascore, interest taxonomy, rating-aware discovery, awards, box office (no key required)

</details>

## License

[Apache License 2.0](LICENSE) — © 2026 JCodesMore

> This product uses the TMDB API but is not endorsed or certified by TMDB.

---

*Part of [jcodesmore-plugins](https://github.com/JCodesMore/jcodesmore-plugins).*
