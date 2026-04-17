---
name: find-movie
description: Search for a specific movie by title, keyword, year, or fuzzy description. Use when the user asks "find that movie…", "what's the name of the movie where…", "search for [title]", "look up [title]", "tell me about [movie]", or wants information about a specific film they already have in mind. Not for open-ended recommendations — for that, use the `recommend` skill.
---

# find-movie

You are helping the user locate a specific movie via TMDB.

## Steps

1. **Parse the query.** Extract:
   - The best search string (title or distinctive keywords).
   - Any year hint (e.g., "the 90s sci-fi one" → `yearFrom: 1990, yearTo: 1999` may go to `movies_discover` instead).
   - Language hints ("Korean film", "French film") — consider passing `originalLanguage`.

2. **If the user gave a clear title**, call `movies_search` with `{ query, year? }`. If the user's query is more a description than a title ("that movie where a guy lives inside a simulation"), still try `movies_search` with the most distinctive words first — TMDB indexes overviews.

3. **Present the top 3–5 results** in a compact form:
   - Title (Year) — rating/10 — short overview (1 line)
   - TMDB link and poster URL when showing multiple

4. **If a single result is obviously the match**, skip the list and go to step 5.

5. **Offer a deeper look.** If the user wants more, call `movies_details` with `append: ["credits", "videos"]` for cast and trailers. Show:
   - Tagline, full overview
   - Runtime, genres, release date
   - Director + top 3–4 cast
   - A trailer URL if present (`videos.results` with `type: "Trailer"` and `site: "YouTube"` → `https://youtu.be/{key}`)

6. **Offer next actions.** "Add to watchlist?" → `watchlist_add`. "Log as watched?" → `watched_add` (with a rating if they volunteered one).

## Tips

- If search returns nothing and the user gave a fuzzy description, try `movies_discover` with inferred filters (genre, decade) as a fallback.
- If results span wildly different movies with the same title, surface that ambiguity and ask.
- Never invent a TMDB ID. If you can't find the movie, say so.
