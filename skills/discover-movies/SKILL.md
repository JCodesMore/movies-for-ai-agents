---
name: discover-movies
description: Browse what's popular, trending, newly released, currently in theaters, or filter by IMDb rating / interest / director. Use when the user asks "what's popular right now", "what's trending", "what's new", "what's in theaters", "show me this week's movies", "anything good out lately", "sci-fi with IMDb 8+", "heist movies", "Nolan films", "hidden gems", or wants to see a feed of current hot titles. Not for personalized picks — for that, use `recommend`. Not for finding a specific title — for that, use `find-movie`.
---

# discover-movies

You are surfacing a feed of notable movies. Two data sources are wired in — route per intent.

## Route to the right tool

### Use `movies_imdb_discover` (imdbapi.dev) when the user's query involves…

- **An IMDb rating threshold.** "IMDb 8+", "rated 7.5 or higher", "only the highly-rated ones" → set `minAggregateRating`.
- **A specific director or actor.** "Nolan's films", "Kubrick movies", "anything with Tilda Swinton" → first call `movies_imdb_find_name({ query })` to resolve the nameId, then `movies_imdb_discover({ nameIds: [...] })`.
- **A thematic subgenre / "interest".** "Heist movies", "time-travel films", "cyberpunk" → optionally call `movies_imdb_interests` to find the right `interestId` (`in...`), then filter on it.
- **Hidden gems.** "Obscure but great", "underrated" → `minAggregateRating: 7.5, maxVoteCount: 50000, sortBy: "SORT_BY_USER_RATING"`.
- **Language/country filters.** "Korean films", "Japanese cinema" → `languageCodes` or `countryCodes`.
- **All-time high-rated.** Anything like "best sci-fi ever" → IMDb rating sort over a wide year range.

### Use TMDB tools when the user asks for…

- **"Trending this week / today / right now"** → `movies_trending` with `window: "week"` (or `"day"`). IMDb's popularity sort is lifetime, not momentum.
- **"Popular"** (generic, no threshold) → `movies_popular`.
- **"In theaters / playing now"** → `movies_now_playing`. Pass `region` if the user mentioned a country.
- **Ambiguous "what's good / new"** with no IMDb qualifier → `movies_trending { window: "week" }` — it weights recency.

### Steps

1. Decide the route. Call the chosen tool.
2. **Filter against user taste** (always). Call `preferences_get` in parallel. Drop results whose genres intersect `dislikedGenres`. Flag entries already in `watched_list` as `[seen]` — don't remove them.
3. **Present 5–8 picks** in a readable format. Default to bold + IMDb hyperlink for the title; IMDb rating is the score users trust:

   ```
   **[Title](https://www.imdb.com/title/{imdbId}/)** (Year[, Country]) — IMDb 8.2 — 128 min
   [Genre, Genre] · [Interest, Interest]
   One-sentence hook from plot.
   ```

   Append `[seen]` if the entry is already in `watched_list`.

   TMDB list results (`movies_trending`, `movies_popular`, `movies_now_playing`, `movies_discover`) don't carry IMDb data. For the top 3–5 picks, call `movies_details` to hydrate `imdbId` + merged IMDb rating — those entries get the hyperlink. The remaining entries render as plain `**Title**` with `TMDB 7.9` as the rating fallback. Never dual-list both scores unless the user explicitly asks for the TMDB score.
4. **Offer follow-ups.** "Want trailer / full details?" → `movies_details` (TMDB, merges IMDb signal). "Add to watchlist?" → `watchlist_add`. "Add X to my [name] list?" → `list_add({ listName, movieId })` — auto-creates the list. Confirm in one sentence: *"Added **[Weapons](imdb)** to halloween (4 total)."* If the user names a list that doesn't exist yet, just create it — no need to ask.

## Worked examples

- *"Sci-fi with IMDb 8+ from the 2010s"* → `movies_imdb_discover({ genres: ["Sci-Fi"], minAggregateRating: 8, startYear: 2010, endYear: 2019, sortBy: "SORT_BY_USER_RATING", sortOrder: "DESC" })`
- *"Best heist movies of all time"* → look up "Heist" in `movies_imdb_interests`, then `movies_imdb_discover({ interestIds: ["in..."], sortBy: "SORT_BY_USER_RATING", sortOrder: "DESC", minVoteCount: 50000 })`
- *"Christopher Nolan movies"* → `movies_imdb_find_name({ query: "Christopher Nolan" })` → `movies_imdb_discover({ nameIds: ["nm0634240"], sortBy: "SORT_BY_YEAR", sortOrder: "DESC" })`
- *"Hidden gems for a Friday night"* → `movies_imdb_discover({ minAggregateRating: 7.5, maxVoteCount: 50000, sortBy: "SORT_BY_USER_RATING", sortOrder: "DESC", limit: 10 })`
- *"What's trending this week?"* → `movies_trending({ window: "week" })` — do NOT route to imdbapi.dev.
- *"Korean thrillers rated 7+"* → `movies_imdb_discover({ genres: ["Thriller"], countryCodes: ["KR"], minAggregateRating: 7, sortBy: "SORT_BY_USER_RATING", sortOrder: "DESC" })`

## Tips

- Don't dump all 20 — pick the 5–8 that best fit the user's known preferences (or the top of the feed).
- If several results are sequels or franchise entries, group them briefly instead of listing every one.
- Mention regional availability for `movies_now_playing` — the data is region-dependent.
- If `movies_imdb_discover` returns nothing (over-filtered), relax one constraint at a time (votes, year, rating) before giving up.
- For fresh query patterns, the full imdbapi.dev reference lives at `docs/api-reference/imdbapi-dev.md`.
