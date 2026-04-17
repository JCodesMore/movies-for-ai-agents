---
name: find-movie
description: Search for a specific movie by title, keyword, year, or fuzzy description. Use when the user asks "find that movie…", "what's the name of the movie where…", "search for [title]", "look up [title]", "tell me about [movie]", or wants information about a specific film they already have in mind. Not for open-ended recommendations — for that, use the `recommend` skill.
---

# find-movie

You are helping the user locate a specific movie. Primary source is TMDB (fuzzy search is better); imdbapi.dev is a fallback for exact-title lookups that need IMDb IDs.

## Steps

1. **Parse the query.** Extract:
   - The best search string (title or distinctive keywords).
   - Any year hint (e.g., "the 90s sci-fi one" → `yearFrom: 1990, yearTo: 1999` may go to `movies_discover`).
   - Language hints ("Korean film", "French film") — consider passing `originalLanguage`.

2. **If the user gave a clear title**, call `movies_search` with `{ query, year? }`. For fuzzy descriptions ("that movie where a guy lives inside a simulation") still try `movies_search` first — TMDB indexes overviews. If TMDB returns nothing and the user gave an exact title, fall back to `movies_imdb_search`.

3. **Present the top 3–5 results** in a compact form:
   - Title (Year) — rating/10 — short overview (1 line)
   - TMDB link and poster URL when showing multiple

4. **If a single result is obviously the match**, skip the list and go to step 5.

5. **Offer a deeper look.** If the user wants more, call `movies_details` with `append: ["credits", "videos"]`. The response now includes IMDb signal automatically:
   - Tagline, full overview
   - **IMDb rating and Metascore** (when present), alongside TMDB rating
   - **IMDb interest tags** (genre/theme tags like Heist, Time Travel)
   - Runtime, genres, release date
   - Director + top 3–4 cast
   - Trailer URL if present (`videos.results` with `type: "Trailer"` and `site: "YouTube"` → `https://youtu.be/{key}`)
   - If the user asks for awards or box office, pass `includeAwards: true` or route to `movies_imdb_details` with `include: ["boxOffice","awards"]`.

6. **Offer next actions.** "Add to watchlist?" → `watchlist_add`. "Log as watched?" → `watched_add` (with a rating if they volunteered one).

## Tips

- Surface IMDb rating prominently when present (users trust it more than TMDB's score). Format: `IMDb 8.7 · TMDB 8.4`.
- If search returns nothing and the user gave a fuzzy description, try `movies_discover` with inferred filters (genre, decade) as a fallback.
- If results span wildly different movies with the same title, surface that ambiguity and ask.
- Never invent a TMDB ID. If you can't find the movie, say so.
- Content warnings / parents guide on request → `movies_imdb_details({ imdbId, include: ["parentsGuide"] })`.
