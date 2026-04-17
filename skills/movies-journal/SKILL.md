---
name: movies-journal
description: Silently keep the user's watched history and taste profile current as they mention movies in conversation. Use whenever the user says "I watched X", "I saw X last night", "I just finished X", "we watched X", "loved X", "hated X", "didn't like X", "that was great/terrible", "best movie ever", "worst movie", "add X to my watchlist", or otherwise signals a movie-viewing event or taste reaction — even if it's a passing mention in the middle of another topic. Do NOT trigger on hypotheticals ("I want to watch X", "I should watch X") — those belong on the watchlist instead. This skill exists so the user's taste profile and history stay rich without any manual logging.
---

# movies-journal

You are quietly maintaining the user's watched list and taste profile from conversational signals. Most invocations should be lightweight — log and move on.

## Decide what the user signaled

- **Watched** ("I watched / saw / just finished / we watched / caught …") → log to watched history.
- **Strong positive** ("loved it", "incredible", "brilliant", "best in years", "⭐⭐⭐⭐⭐") → log with high rating + update taste profile.
- **Strong negative** ("hated it", "terrible", "walked out", "biggest disappointment") → log with low rating + update taste profile.
- **Want to watch** ("I want to see", "I'll check out", "add to my list") → watchlist, not watched.
- **Hypothetical / future** ("if I watched X", "I should watch X", "someone told me to watch X") → do NOT log; optionally offer to add to watchlist.

## Steps

1. **Resolve the title.** Call `movies_search({ query: "<title>", year: <if hinted> })`. If exactly one clear match, use it. If multiple, pick the most popular (highest `voteCount`); if still ambiguous, ask the user to confirm — showing Title (Year) — once, not repeatedly.

2. **Log the event.**
   - Watched event → `watched_add({ movieId, rating?, notes? })`. Infer rating from the sentiment (loved = 5, liked = 4, fine = 3, disliked = 2, hated = 1). Only set `rating` if the signal is clear — leave null otherwise. Capture a short `notes` field if the user said *why* they liked/disliked it.
   - Watchlist event → `watchlist_add({ movieId, note? })`. Capture *why* they want to see it in `note` when stated.

3. **Update taste (only on strong signals).** If the user clearly loved or hated the film, call `preferences_set` to reinforce:
   - **Loved**: append the movie's main genre(s) to `likedGenres`; append director (if known from `movies_details`) to `favoriteDirectors`; append the TMDB ID to `favoriteMovies`.
   - **Hated**: append unexpected genres to `dislikedGenres` *only if* the user's complaint was genre-shaped ("too slow", "too much horror"). Don't infer disliked genres from a single bad review.

4. **Acknowledge briefly.** A single sentence: *"Logged — Arrival (2016), loved it. Your sci-fi liked-list now has 4 films."* Then return control to whatever the user was actually doing. Don't derail the conversation.

## Guardrails

- Never log a movie you aren't confident you identified correctly. Better to ask than to pollute the history.
- Don't double-log. If the movie is already in watched history, update rather than append (the `watched_add` tool handles this — but verify the user's intent if they seem to be re-rating vs. re-watching).
- Don't narrate the logging process — users find that noisy. One sentence of confirmation is enough.
- If the user is mid-task (debugging, writing code) and drops a casual movie mention, keep the confirmation extra short and return to their task immediately.
