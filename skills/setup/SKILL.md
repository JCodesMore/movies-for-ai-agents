---
name: setup
description: First-run configuration for the movies-for-ai-agents plugin. Use when the user says "set up movies-for-ai-agents", "configure movies", "first run", "add my TMDB key", "set up my movie profile", or when any other movies-for-ai-agents skill calls an MCP tool that reports "TMDB API key not configured". Captures the TMDB API key and, optionally, a brief taste-priming pass (favorite genres, directors, a few favorite movies) so later recommendations work out of the gate.
---

# setup

You are setting up the `movies-for-ai-agents` plugin for the user. This is a one-time flow that writes to user-global storage at `~/.claude/data/movies-for-ai-agents/` (follows the user across every Claude Code project).

## Steps

1. **Check current status.** Call the `config_status` MCP tool. If `configured: true`, tell the user it's already set up, show the summary, and ask if they want to re-prime their taste profile. Otherwise proceed.

2. **Explain briefly** (1–2 sentences) what the plugin does and that a free [TMDB API key](https://www.themoviedb.org/settings/api) is required. Link the URL. Mention that IMDb ratings and richer discovery filters come from imdbapi.dev automatically — no extra key needed.

3. **Ask for the TMDB API key.** Accept either a TMDB v3 API key or a v4 read access token. When the user provides it, call `config_set_api_key` with `apiKey`. The tool performs a live smoke-test — if it errors, surface the error and ask them to retry.

4. **Offer taste-priming (optional).** Say something like *"Want to spend 30 seconds priming your taste profile? I'll ask 3 quick questions and recommendations will work better from the start."* If yes, ask:
   - **3 genres you love and 1–2 you avoid.** Call `preferences_set` with `likedGenres`, `dislikedGenres`.
   - **2–3 directors whose work you'd watch sight unseen.** Call `preferences_set` with `favoriteDirectors`.
   - **3–5 movies that represent your taste well.** For each title they give, call `movies_search` to resolve it to a TMDB ID, confirm the match if ambiguous, then call `preferences_set` with `favoriteMovies: [ids...]`.

   If they decline, skip priming — preferences fill in naturally as they watch things over time (the `movies-journal` skill handles that).

5. **Confirm.** Call `config_status` again and show the result. Tell them they can now:
   - *"Find me that 90s sci-fi thriller…"* → search
   - *"What's trending this week?"* → discover
   - *"What should I watch tonight?"* → recommend
   - *"I just watched X, loved it"* → auto-logs to history
   - *"Add X to my halloween list"* → custom named lists, organized by theme
   - When you start a suggested film, it's tracked as *active* — next session I'll ask how it went

## Notes

- The TMDB key is stored in `~/.claude/data/movies-for-ai-agents/config.json` (chmod 600). Alternatively, the user can set `TMDB_API_KEY` in their environment — env var takes precedence over the stored value.
- Never echo the TMDB key back in your response after saving it.
- If the user has `TMDB_API_KEY` already set, skip the key prompt and jump straight to taste-priming.
