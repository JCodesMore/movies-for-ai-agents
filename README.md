<div align="center">

# Movies for AI Agents

### Your personal AI movie buddy

Ask *"what should I watch tonight?"* and get picks that actually fit your taste. Mention a film and Claude quietly logs it. The more you talk, the smarter it gets.

[![Discord](https://img.shields.io/badge/Join_the_community-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/babcVNJBet)

[Quick Start](#quick-start) · [Try it](#try-it) · [Discord](https://discord.gg/babcVNJBet)

[![Watch the demo](https://img.youtube.com/vi/hX12xFf8-9I/maxresdefault.jpg)](https://youtu.be/hX12xFf8-9I)

*Click to watch — 40-second demo.*

</div>

---

## Quick Start

**1. Get a free TMDB API key** (~2 minutes) at https://www.themoviedb.org/settings/api — copy your **API key**.

**2. Install the plugin** — inside Claude Code, run:

```
/plugin marketplace add JCodesMore/jcodesmore-plugins
/plugin install movies-for-ai-agents@jcodesmore-plugins
```

Then fully **restart Claude Code** (quit the app and reopen).

**3. Add your key** — run `/movies-for-ai-agents:setup` and paste it when prompted. Done.

## Try it

Talk to Claude like a friend:

- *"What should I watch tonight?"*
- *"Find me that 90s movie about a hacker..."*
- *"I just finished Arrival, absolutely loved it."* — auto-logs it, learns your taste
- *"Add Weapons to my halloween list."* — custom themed lists, organized by mood
- *"Sci-fi with an IMDb rating of 8 or higher from the 2010s."*
- *"Hidden gems — highly rated but obscure."*

Tell Claude you'll watch something tonight, and next session it'll ask how it went. Your taste profile follows you across every project and every machine.

## Community

[**Discord**](https://discord.gg/babcVNJBet) — chat, help, show-and-tell · [**Issues**](https://github.com/JCodesMore/movies-for-ai-agents/issues) — bugs & feature requests · [**Contribute**](CONTRIBUTING.md) · [**More plugins**](https://github.com/JCodesMore/jcodesmore-plugins)

<details>
<summary><b>Where your data lives</b></summary>

Everything stays on **your machine**, outside any one project folder:

```
~/.claude/data/movies-for-ai-agents/
├── config.json           ← your TMDB API key (permissions 600)
├── preferences.json      ← your taste profile (liked genres, directors, interests, etc.)
├── watched.json          ← what you've seen
├── lists.json            ← every custom list, including the default "watchlist"
├── active.json           ← films you've started but not finished
├── imdb-cache.json       ← cached imdbapi.dev responses (24h/6h TTLs)
└── imdb-interests.json   ← cached IMDb interest taxonomy (7d TTL)
```

Your taste follows you across every project and every machine that shares this directory. No telemetry, no analytics — nothing leaves your machine except TMDB search queries.

</details>

<details>
<summary><b>Troubleshooting</b></summary>

| Something's off | Fix |
|---|---|
| *"TMDB API key not configured"* | Run `/movies-for-ai-agents:setup` — or set `TMDB_API_KEY` in your shell environment. |
| Plugin doesn't show up in `/mcp` | Fully quit Claude Code and reopen. The plugin registers on startup. |
| *"Cannot find module '@modelcontextprotocol/sdk'"* | Only happens with manual install — run `cd mcp-server && npm install`. |
| Recommendations still feel generic | Tell Claude about 3–5 movies you love. Give it some signal to work with. |

More help in the [Discord](https://discord.gg/babcVNJBet).

</details>

<details>
<summary><b>Advanced install (without the marketplace)</b></summary>

If you'd rather clone and run it directly:

```bash
git clone https://github.com/JCodesMore/movies-for-ai-agents.git
cd movies-for-ai-agents/mcp-server && npm install
cd ..
claude --plugin-dir .
```

Or skip `/movies-for-ai-agents:setup` entirely by exporting your key as an environment variable:

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
