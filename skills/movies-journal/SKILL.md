---
name: movies-journal
description: Silently keep the user's watched history and taste profile current as they mention movies in conversation. Use whenever the user says "I watched X", "I saw X last night", "I just finished X", "we watched X", "loved X", "hated X", "didn't like X", "that was great/terrible", "best movie ever", "worst movie", "add X to my watchlist", or otherwise signals a movie-viewing event or taste reaction — even if it's a passing mention in the middle of another topic. Do NOT trigger on hypotheticals ("I want to watch X", "I should watch X") — those belong on the watchlist instead. This skill exists so the user's taste profile and history stay rich without any manual logging.
---

# movies-journal

You are quietly maintaining the user's watched list and taste profile from conversational signals. Most invocations should be lightweight — log and move on.

## Decide what the user signaled

- **Watched** ("I watched / saw / just finished / we watched / caught …") → log to watched history. **If the title is in `active_list`, also call `active_remove` to clear it.**
- **Strong positive** ("loved it", "incredible", "brilliant", "best in years", "⭐⭐⭐⭐⭐") → log with high rating + update taste profile.
- **Strong negative** ("hated it", "terrible", "walked out", "biggest disappointment") → log with low rating + update taste profile.
- **Dropped active title** ("dropped X", "couldn't get into X", "gave up on X") → if X is in `active_list`, call `active_remove({ movieId })`. Do NOT call `watched_add` — they didn't really see it.
- **Want to watch** ("I want to see", "I'll check out", "add to my list") → watchlist, not watched.
- **Custom list ops** ("add X to my Y list", "remove X from Y", "what's on my Y list?", "show me my lists", "rename Y to Z", "delete my Y list") → route to the `list_*` MCP tools directly. See list-ops table below.
- **Hypothetical / future** ("if I watched X", "I should watch X", "someone told me to watch X") → do NOT log; optionally offer to add to watchlist.

## Steps

1. **Resolve the title.** Call `movies_search({ query: "<title>", year: <if hinted> })`. If exactly one clear match, use it. If multiple, pick the most popular (highest `voteCount`); if still ambiguous, ask the user to confirm — showing Title (Year) — once, not repeatedly.

   **Active resolution shortcut.** Before resolving from scratch, check `active_list` if the user said "finished/dropped/watched" with a title that might match an in-progress entry. If you find a match, you already have the `movieId` and can skip the search.

2. **Log the event.**
   - Watched event → `watched_add({ movieId, rating?, notes? })`. Infer rating from the sentiment (loved = 5, liked = 4, fine = 3, disliked = 2, hated = 1). Only set `rating` if the signal is clear — leave null otherwise. Capture a short `notes` field if the user said *why* they liked/disliked it. **If the title was in `active_list`, also call `active_remove({ movieId })`.**
   - Dropped active title → `active_remove({ movieId })` only. No `watched_add`.
   - Watchlist event → `watchlist_add({ movieId, note? })`. Capture *why* they want to see it in `note` when stated.
   - Custom list event → see list-ops table below.

3. **Update taste (only on strong signals).** If the user clearly loved or hated the film, call `preferences_set` to reinforce:
   - **Loved**: append the movie's main genre(s) to `likedGenres`; append director (if known from `movies_details`) to `favoriteDirectors`; append the TMDB ID to `favoriteMovies`.
   - **Hated**: append unexpected genres to `dislikedGenres` *only if* the user's complaint was genre-shaped ("too slow", "too much horror"). Don't infer disliked genres from a single bad review.

4. **Acknowledge briefly.** A single sentence: *"Logged — Arrival (2016, IMDb 7.9), loved it. Your sci-fi liked-list now has 4 films."* If the TMDB details response carries an IMDb rating, feel free to cite it in the confirmation (it gives the user a subtle anchor for their own rating over time). Then return control to whatever the user was actually doing. Don't derail the conversation.

## Custom list ops

Map directly to MCP tools — no resolution dance unless adding a movie that needs `movieId`:

| User says… | Tool to call |
|---|---|
| *"add X to my halloween list"* | resolve title → `list_add({ listName: "halloween", movieId })` (auto-creates the list) |
| *"remove X from halloween"* | resolve title → `list_remove({ listName: "halloween", movieId })` |
| *"what's on my halloween list?"* | `list_list({ listName: "halloween" })` — render entries with IMDb hyperlinks |
| *"show me my lists"* / *"what lists do I have?"* | `lists_names` — render as one-line summary with counts |
| *"rename halloween to spooky"* | `list_rename({ oldName: "halloween", newName: "spooky" })` |
| *"delete my halloween list"* | `list_delete({ listName: "halloween" })` (refuses for the reserved `watchlist`) |

Confirm in one sentence with the bolded IMDb-hyperlinked title format: *"Added **[Weapons](https://www.imdb.com/title/tt30253473/)** to halloween (4 total)."*

## Guardrails

- Never log a movie you aren't confident you identified correctly. Better to ask than to pollute the history.
- Don't double-log. If the movie is already in watched history, update rather than append (the `watched_add` tool handles this — but verify the user's intent if they seem to be re-rating vs. re-watching).
- Don't narrate the logging process — users find that noisy. One sentence of confirmation is enough.
- If the user is mid-task (debugging, writing code) and drops a casual movie mention, keep the confirmation extra short and return to their task immediately.
