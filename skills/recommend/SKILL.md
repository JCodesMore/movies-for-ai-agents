---
name: recommend
description: Personalized movie recommendations tailored to the user's stored taste profile, watch history, and whatever mood/constraint they mention right now. Use when the user asks "what should I watch", "recommend me a movie", "suggest something", "I'm in the mood for [X]", "something like [X]", "help me pick a movie", "got two hours tonight — what should I watch", "anything I'd like that's new", or any other open-ended ask for a personalized pick. This is the flagship skill — invest in making each recommendation feel reasoned, not generic.
---

# recommend

You are giving the user a short, confident, personalized shortlist of movies — with reasoning tied to what you know about them.

## Gather context (always)

Call these three MCP tools in parallel before anything else:
1. `preferences_get` — taste profile.
2. `watched_list` with `limit: 50` — exclude seen movies; use recent watches as signal.
3. `movies_genres` — for name↔id mapping when filtering.

## Choose a strategy based on the user's prompt

### A. "Something like [seed movie]"
1. `movies_search({ query })` → resolve seed to a TMDB ID. Confirm match if ambiguous.
2. `movies_recommendations({ movieId })`.
3. Filter out movies already in `watched_list`. Filter out `dislikedGenres`.
4. Pick top 3–5. For each, write a one-sentence "why it fits" anchored to either the seed or their taste profile.

### B. Mood / constraint query ("atmospheric thriller under 2 hours", "a feel-good comedy", "nothing too heavy")
1. Translate mood → genre filters. Use `movies_genres` if unsure of IDs.
2. Call `movies_discover` with:
   - `genres` from the mood
   - `excludeGenres` from `dislikedGenres`
   - `minRating: 6.5` and `minVotes: 300` by default (quality floor)
   - Runtime filters when they mention a time budget
   - `sortBy: "popularity.desc"` unless they want something obscure
3. Filter out watched. Pick 3–5 with brief "why it fits" reasoning.

### C. "What should I watch tonight" (no constraint given)
1. Combine signals: mix top 2–3 from `movies_trending` (week) with 1–2 from `movies_discover` using `likedGenres` and `favoriteDirectors` when present.
2. Cross-reference `favoriteMovies` → fetch `movies_recommendations` on one of them for variety.
3. De-duplicate, filter watched, pick 3–5.

## Present the recommendations

Format each pick as:

```
🎬 **Title** (Year) — rating/10 — runtime min
[Genre, Genre]
One-to-two sentence hook from the overview.
→ Why for you: [specific reason anchored to their profile or the current ask]
```

Close with a soft prompt: *"Want a trailer for any of these? Or add one to your watchlist?"*

## Auto-updates

- If the user confirms a pick and says they're going to watch it → call `watchlist_add` (they haven't watched it yet, so not `watched_add`).
- If they reject all suggestions with a reason ("too slow", "nothing with horror"), immediately call `preferences_set` to update `dislikedGenres` or `avoidKeywords` so future runs improve.

## Quality bar

- Every recommendation must come from TMDB data (never invent titles). Use `movies_details` only if you need to verify runtime or a cast member to justify reasoning.
- Keep the shortlist tight: 3 confident picks beats 10 hedged ones.
- "Why for you" must be *specific* to the user, not generic ("it's a great movie"). Anchor to their preferences, a recent watch, or the current mood.
