# imdbapi.dev REST API Reference

## Service overview

- **Base URL:** `https://api.imdbapi.dev`
- **Protocol:** REST over HTTPS (GraphQL and gRPC are advertised but not live — REST is what works)
- **Spec version:** 2.7.12 (per swagger)
- **Auth:** none required
- **Rate limit:** unofficial ~1000/day observed; no per-second limit published
- **Maintainer:** not publicly identified
- **Reliability:** no public status page; treat as best-effort. Callers must handle failure gracefully.
- **ID scheme:** IMDb-native. Titles `tt` + 7-10 digits. Names `nm` + 7 digits. Interests `in` + 7 digits.

## Endpoints

### Titles (16)

| Method | Path | Purpose |
|---|---|---|
| GET | `/titles` | **List/discover with filters** (core endpoint) |
| GET | `/titles/{titleId}` | Single title details |
| GET | `/titles:batchGet` | Up to 5 titles in one call |
| GET | `/titles/{titleId}/credits` | Cast/crew paginated |
| GET | `/titles/{titleId}/releaseDates` | Per-country release dates |
| GET | `/titles/{titleId}/akas` | Alternative titles |
| GET | `/titles/{titleId}/seasons` | Seasons (series) |
| GET | `/titles/{titleId}/episodes` | Episodes (paginated by season) |
| GET | `/titles/{titleId}/images` | Stills/posters |
| GET | `/titles/{titleId}/videos` | Trailers/clips/featurettes |
| GET | `/titles/{titleId}/awardNominations` | Awards and nominations |
| GET | `/titles/{titleId}/parentsGuide` | Content advisory with severity breakdowns |
| GET | `/titles/{titleId}/certificates` | Per-country content rating |
| GET | `/titles/{titleId}/companyCredits` | Production/distribution companies |
| GET | `/titles/{titleId}/boxOffice` | Budget + gross + opening weekend |
| GET | `/search/titles` | Search by query string |

### Names (7)

| Method | Path | Purpose |
|---|---|---|
| GET | `/names/{nameId}` | Person details |
| GET | `/names/{nameId}/images` | Profile images |
| GET | `/names/{nameId}/filmography` | Full filmography, filterable by category |
| GET | `/names/{nameId}/relationships` | Spouses/family |
| GET | `/names/{nameId}/trivia` | Trivia entries |
| GET | `/names:batchGet` | Up to 5 names in one call |
| GET | `/chart/starmeter` | Trending personalities (IMDb star meter) |

### Interests (2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/interests` | Full taxonomy (~162 items) |
| GET | `/interests/{interestId}` | Single interest detail |

## `/titles` query params (the workhorse)

Array params use multi-format: `?genres=Action&genres=Drama` — NOT comma-separated.

| Param | Type | Notes |
|---|---|---|
| `types` | array | enum: MOVIE, TV_SERIES, TV_MINI_SERIES, TV_SPECIAL, TV_MOVIE, SHORT, VIDEO, VIDEO_GAME |
| `genres` | array | Action, Adventure, Animation, Biography, Comedy, Crime, Documentary, Drama, Family, Fantasy, Film-Noir, History, Horror, Music, Musical, Mystery, News, Romance, Sci-Fi, Sport, Thriller, War, Western |
| `countryCodes` | array | ISO 3166-1 alpha-2, e.g. US, GB, JP, KR |
| `languageCodes` | array | ISO 639-1/2, e.g. en, es, ja |
| `nameIds` | array | e.g. nm0634240 (Nolan). Filters to titles this person is credited on |
| `interestIds` | array | from `/interests`. Granular themes — e.g. Heist, Time Travel, Space Opera |
| `startYear` | int | inclusive |
| `endYear` | int | inclusive |
| `minVoteCount` | int | 0 .. 1e9 |
| `maxVoteCount` | int | 0 .. 1e9 |
| `minAggregateRating` | float | 0.0 .. 10.0 |
| `maxAggregateRating` | float | 0.0 .. 10.0 |
| `sortBy` | string | SORT_BY_POPULARITY, SORT_BY_RELEASE_DATE, SORT_BY_USER_RATING, SORT_BY_USER_RATING_COUNT, SORT_BY_YEAR |
| `sortOrder` | string | ASC, DESC |
| `limit` | int | max 50 |
| `pageToken` | string | opaque, from previous response's `nextPageToken` |

## Response fields — `imdbapiTitle`

Top-level:
- `id`, `type`, `isAdult`, `primaryTitle`, `originalTitle`
- `primaryImage { url, width, height }`
- `startYear`, `endYear` *(series)*
- `runtimeSeconds` *(divide by 60 for minutes)*
- `genres[]`
- `rating { aggregateRating (0..10 float), voteCount }`
- `metacritic { metascore (0..100), reviewCount }` *(optional)*
- `plot`
- `directors[]`, `writers[]`, `stars[]` — each is a mini-Name object
- `originCountries[] { code, name }`
- `spokenLanguages[] { code, name }`
- `interests[]` — mini-Interest objects (ID + name)

## Response fields — `imdbapiName`

- `id`, `displayName`, `alternativeNames[]`
- `primaryImage`
- `primaryProfessions[]` (director, writer, actor, etc.)
- `biography`
- `heightCm` *(optional)*, `birthName`
- `birthDate { year, month, day }`, `birthLocation`
- `deathDate`, `deathLocation`, `deathReason`
- `meterRanking { currentRank, changeDirection, difference }`

## Response fields — other objects (quick map)

- `imdbapiCredit` — `title`, `name`, `category`, `characters[]`, `episodeCount`
- `imdbapiImage` — `url`, `width`, `height`, `type`
- `imdbapiVideo` — `id`, `type`, `name`, `primaryImage`, `description`, `width`, `height`, `runtimeSeconds`
- `imdbapiRelease` — `country { code, name }`, `releaseDate`, `attributes[]`
- `imdbapiAka` — `text`, `country`, `language`, `attributes[]`
- `imdbapiAward` — `event { id, name }`, `year`, `text`, `category`, `nominees[]`, `isWinner`
- `imdbapiBoxOffice` — `domesticGross`, `worldwideGross`, `openingWeekendGross`, `productionBudget` (each is `{ amount (string), currency }`)
- `imdbapiInterest` — `id`, `name`, `description`, `primaryImage`, `isSubgenre`, `similarInterests[]`
- `imdbapiParentsGuide` — `category` (SEXUAL_CONTENT | VIOLENCE | PROFANITY | ALCOHOL_DRUGS | FRIGHTENING_INTENSE_SCENES), `severityBreakdowns[]`, `reviews[]`

## Finding a nameId (no direct name-search endpoint)

1. `GET /search/titles?query=<title-they're-in>&limit=1`
2. `GET /titles/{that-imdbId}/credits?pageSize=20`
3. Extract `name.id` for the person you want.
4. Reuse that nameId in `/titles?nameIds=...` filters.

Our plugin wraps this as the `movies_imdb_find_name` tool.

## Worked examples

```
# IMDb 8+ sci-fi from 2010-2019
GET /titles?types=MOVIE&genres=Sci-Fi&minAggregateRating=8&startYear=2010&endYear=2019&sortBy=SORT_BY_USER_RATING&sortOrder=DESC&limit=20

# Most popular Spanish-language movies
GET /titles?types=MOVIE&languageCodes=es&sortBy=SORT_BY_POPULARITY&sortOrder=DESC&limit=20

# Nolan filmography (movies, rated 7+, newest first)
GET /titles?types=MOVIE&nameIds=nm0634240&minAggregateRating=7&sortBy=SORT_BY_YEAR&sortOrder=DESC

# Recent heavy hitters (2024+, 100k+ votes)
GET /titles?types=MOVIE&minVoteCount=100000&startYear=2024&sortBy=SORT_BY_RELEASE_DATE&sortOrder=DESC&limit=20

# Hidden gems (high rating, few votes)
GET /titles?types=MOVIE&minAggregateRating=7.5&maxVoteCount=50000&sortBy=SORT_BY_USER_RATING&sortOrder=DESC&limit=20

# Heist films (interest-based)
GET /titles?types=MOVIE&interestIds=in0000050&sortBy=SORT_BY_USER_RATING&sortOrder=DESC&limit=20

# Batch rating lookup (up to 5 per call)
GET /titles:batchGet?titleIds=tt0816692&titleIds=tt0111161&titleIds=tt0468569

# Details + credits flow
GET /titles/tt0816692
GET /titles/tt0816692/credits?pageSize=50
GET /titles/tt0816692/awardNominations
GET /titles/tt0816692/boxOffice

# Search
GET /search/titles?query=interstellar&limit=5
```

## Gotchas

- `runtimeSeconds` is SECONDS, not minutes. Divide by 60.
- Array params: use `?k=a&k=b`, NOT `?k=a,b`.
- No `/search/names` endpoint. Find nameIds via credits.
- Silent param drop: misspelled/unknown params are ignored, not rejected. Test by observing.
- No `totalCount` on most list endpoints. Only `nextPageToken` → iterate or stop.
- Some endpoints use `limit`, others use `pageSize`. `/titles` uses `limit`. Per-title subresources use `pageSize`.
- Batch endpoints cap at 5 IDs per call.
- Box office amounts come as strings: `{ amount: "188020017", currency: "USD" }`.
- The spec advertises GraphQL + gRPC. Don't rely on these — REST is all that's verified live.
