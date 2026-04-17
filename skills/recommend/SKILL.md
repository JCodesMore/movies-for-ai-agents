---
name: recommend
description: Personalized movie recommendations tailored to the user's stored taste profile, watch history, and whatever mood/constraint they mention right now. Use when the user asks "what should I watch", "recommend me a movie", "suggest something", "I'm in the mood for [X]", "something like [X]", "help me pick a movie", "got two hours tonight — what should I watch", "anything I'd like that's new", or any other open-ended ask for a personalized pick. This is the flagship skill — invest in making each recommendation feel reasoned, not generic.
---

# recommend

You are giving the user a short, confident, personalized shortlist of movies — with reasoning tied to what you know about them.

## Gather context (always)

Call these three MCP tools in parallel before anything else:
1. `preferences_get` — taste profile (now includes `likedInterests`, `likedCountries`, `likedLanguages`).
2. `watched_list` with `limit: 50` — exclude seen movies; use recent watches as signal.
3. `movies_genres` — for name↔id mapping when filtering.

## Choose a strategy based on the user's prompt

### A. "Something like [seed movie]"
1. `movies_search({ query })` → resolve seed to a TMDB ID. Confirm match if ambiguous.
2. `movies_recommendations({ movieId })` — TMDB's ML similar-movies. imdbapi.dev's `interestIds` are metadata tags, not real similarity; keep TMDB for this path.
3. Filter out movies already in `watched_list`. Filter out `dislikedGenres`.
4. Collect the `imdbId`s of the top 5–8 candidates (from `movies_details` or TMDB's included field) and call `movies_imdb_batch_rating({ imdbIds })` so each pick carries an IMDb rating.
5. Pick top 3–5. For each, write a one-sentence "why it fits" anchored to either the seed or their taste profile. Surface IMDb rating when available.

### B. Rating-aware or thematic query ("good sci-fi rated 8+", "heist movies", "Japanese drama")
1. Route to `movies_imdb_discover`:
   - IMDb threshold → `minAggregateRating`.
   - Thematic subgenre → look up the `interestId` via `movies_imdb_interests` once per session, cache the mapping mentally, pass via `interestIds`.
   - Director/actor → `movies_imdb_find_name` → `nameIds`.
   - Language/country → `languageCodes` / `countryCodes`.
2. Merge the user's taste axes as soft biases: if they have `favoriteDirectors`, resolve one to a nameId and consider a second pass; if they have `likedInterests`, include them.
3. Filter out watched. Pick 3–5 with brief "why it fits" reasoning.

### C. Mood / constraint query ("atmospheric thriller under 2 hours", "feel-good comedy", "nothing too heavy")
1. Translate mood → genre filters. Use `movies_genres` if unsure of IDs.
2. Call `movies_discover` with:
   - `genres` from the mood
   - `excludeGenres` from `dislikedGenres`
   - `minRating: 6.5` and `minVotes: 300` by default (quality floor). If the user hinted at quality ("something actually good"), set `minImdbRating: 7` — that flips routing to imdbapi.dev automatically.
   - Runtime filters when they mention a time budget
   - `sortBy: "popularity.desc"` unless they want something obscure
3. Filter out watched. Pick 3–5 with brief "why it fits" reasoning.

### D. "What should I watch tonight" (no constraint given)
1. Combine signals: mix top 2–3 from `movies_trending` (week) with 1–2 from `movies_discover` using `likedGenres` and `favoriteDirectors`, and 1 from `movies_imdb_discover` using `likedInterests` when present.
2. Cross-reference `favoriteMovies` → fetch `movies_recommendations` on one of them for variety.
3. De-duplicate, filter watched, pick 3–5. Batch-enrich with IMDb ratings via `movies_imdb_batch_rating`.

## Present the recommendations

Format each pick as:

```
🎬 **Title** (Year) — IMDb 8.2 · TMDB 7.9 — 128 min
[Genre, Genre] · [Heist, Neo-Noir] (if interest tags present)
One-to-two sentence hook from the overview.
→ Why for you: [specific reason anchored to their profile or the current ask]
```

When IMDb data isn't available, fall back to TMDB rating only — don't leave a placeholder.

Close with a soft prompt: *"Want a trailer for any of these? Or add one to your watchlist?"*

## Auto-updates

- If the user confirms a pick and says they're going to watch it → call `watchlist_add` (they haven't watched it yet, so not `watched_add`).
- If they reject all suggestions with a reason ("too slow", "nothing with horror"), immediately call `preferences_set` to update `dislikedGenres` or `avoidKeywords` so future runs improve.
- If they volunteer language/country love ("more Korean stuff please") → `preferences_set({ likedCountries: ["KR"] })` or `likedLanguages: ["ko"]`.
- If they clearly like a theme ("love heist films") → map to an `interestId` and store via `likedInterests`.

## Quality bar

- Every recommendation must come from TMDB or imdbapi.dev data (never invent titles).
- Keep the shortlist tight: 3 confident picks beats 10 hedged ones.
- "Why for you" must be *specific* to the user, not generic. Anchor to preferences, a recent watch, the current mood, or the IMDb signal when it's surprisingly strong.
- For fresh query patterns, consult `docs/api-reference/imdbapi-dev.md` and `docs/api-reference/tmdb.md`.
