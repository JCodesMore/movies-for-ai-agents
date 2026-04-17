---
name: discover-movies
description: Browse what's popular, trending, newly released, or currently in theaters. Use when the user asks "what's popular right now", "what's trending", "what's new", "what's in theaters", "show me this week's movies", "anything good out lately", or wants to see a feed of current hot titles. Not for personalized picks — for that, use `recommend`. Not for finding a specific title — for that, use `find-movie`.
---

# discover-movies

You are surfacing a feed of currently notable movies from TMDB.

## Decide which feed to use

- **"trending this week / today / right now"** → `movies_trending` with `window: "week"` (or `"day"` if they said "today" / "right now").
- **"popular"** → `movies_popular`.
- **"in theaters / playing now / what's at the theater"** → `movies_now_playing` (pass `region` if the user mentioned a country, else default).
- **Ambiguous "what's good / new"** → prefer `movies_trending` with `window: "week"` — it weights recency.

## Steps

1. Call the chosen MCP tool.

2. **Filter against user taste** (optional but recommended). Call `preferences_get` in parallel. Drop results whose `genres` intersect `dislikedGenres`. Mark results already in `watched_list` as "seen" — don't remove them, but annotate.

3. **Present 5–8 picks** in a readable format:
   - Title (Year) — rating/10
   - One-sentence hook from the overview
   - Genres
   - `[seen]` marker if already watched

4. **Offer follow-ups.** "Want the trailer / full details?" → `movies_details` with `append: ["videos","credits"]`. "Add to watchlist?" → `watchlist_add`.

## Tips

- Don't dump all 20 — pick the 5–8 that best fit the user's known preferences (or the top of the feed if no preferences exist).
- If several results are sequels or franchise entries, group them briefly instead of listing every one.
- Mention regional availability for `movies_now_playing` — the data is region-dependent.
