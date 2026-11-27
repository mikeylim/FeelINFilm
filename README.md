# FeelINFilm

FeelINFilm (FIF) helps you decide what to watch. Describe your mood, a film you liked, or the kind of movie you have in mind. You can also look up a title directly and explore its cast, ratings, trailers, and related films.

## Features

- **Conversational recommendations.** Gemini uses the current conversation to suggest films. Verified picks appear while matching continues, and ratings fill in afterward. A request with a rating minimum waits for the scores it needs to verify the picks.
- **Refine your picks.** Chat aims for three or four films for quick or narrow requests and five or six for typical requests. Ask for a longer list or a specific number to get up to ten verified films. **More picks** keeps the current criteria and skips titles already suggested.
- **Movie lookup.** Search by title or browse weekly trending films. Cards appear as soon as TMDB returns them, and ratings fill in afterward. Open a detail page for cast, crew, release information, awards summaries, and trailers where available.
- **Linked ratings.** Compare IMDb, Rotten Tomatoes, and Letterboxd scores in compact badges on movie cards and detail pages. A dash marks an unavailable score.
- **Verified Oscar picks.** Direct winner questions with a ceremony year and category use the Academy records. Awards recommendations check each film’s IMDb ID against the requested ceremony and category. Cards show the exact wins and link to the ceremony.
- **Guest watchlist.** Save films from lookup, recommendations, or detail pages and revisit them from the sidebar.
- **Watched films.** Mark titles as already watched from movie cards or detail pages and open **Watched** from the sidebar. Chat excludes watched films from recommendations by default, including when you ask for **More picks**. You can turn off the filter in the composer.
- **Search and sort your lists.** Filter Watchlist and Watched by title as you type. Both lists support the same rating, release, runtime, and title sorts as recommendations. **Date watched (newest)** uses the viewing date and puts undated films last.
- **List dates.** Watchlist and Watched record their own action timestamps. Each list displays the dates in your timezone and sorts by its action date. Older entries keep their original order after dated entries. Select **Already watched** on a card or detail page to log a film and pick the day you saw it, or choose **Skip date**. You can also edit the date from the Watched list.
- **Personal ratings.** Rate a watched film from 0.5 to 5 stars directly on its detail page. Your scores appear on film cards, and Watched can sort by **My rating**. Scores are saved in this browser.
- **Browser-local preferences.** Switch between light and dark themes, reopen recent conversations, or dictate a prompt in a browser that supports speech recognition.
- **English, Korean, and French.** Use the language selector in the top bar to switch the interface, sample prompts, voice input, and new replies. FeelINFilm requests film metadata from TMDB in the selected language. Saved chats keep their original text.

## Quick start

Use Node.js 22.13+ within the 22.x release line, or Node.js 24.x.

```sh
git clone https://github.com/mikeylim/FeelINFilm.git
cd FeelINFilm
npm ci
cp .env.example .env
```

Add your provider keys to `.env` using the table below. Then start the development server.

```sh
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`. Restart the server after editing `.env`.

## API configuration

| Variable | Used for |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | Recommended TMDB credential. Enables movie lookup, details, posters, and matching recommendations to film records. |
| `TMDB_API_KEY` | Alternative TMDB v3 credential. Use either TMDB variable. |
| `GEMINI_API_KEY` | Required for the recommendation chat. |
| `GEMINI_MODEL` | Optional primary model override. The default is `gemini-3.8-flash`. |
| `OMDB_API_KEY` | Optional. Provides IMDb scores and awards summaries where available. |
| `MDBLIST_API_KEY` | Optional. Provides Letterboxd and Tomatometer scores and film links where available. It can also supply IMDb scores. |
| `PROVIDER_METRICS` | Optional. Set to `1` to log provider timings, chat outcomes, and server time to the first movie cards. |

The server keeps provider credentials out of the browser bundle. Movie lookup requires TMDB. Chat requires both Gemini and TMDB. Chat starts with Gemini 3.8 Flash by default and can retry once with Gemini 3.5 Flash-Lite after a timeout, temporary failure, or rate limit on the primary model. After a successful fallback, that server instance can use Flash-Lite for one minute and retry on the primary model if Flash-Lite becomes unavailable. Gemini attempts share a 40-second budget, and the full chat request has a 54-second deadline that includes film matching and ratings.

[TMDB credentials](https://developer.themoviedb.org/docs/getting-started) · [Gemini keys](https://aistudio.google.com/api-keys) · [OMDb keys](https://www.omdbapi.com/apikey.aspx) · [MDBList keys](https://docs.mdblist.com/docs/api)

## Try a prompt

- “I liked Arrival. Suggest thoughtful science fiction under two hours.”
- “Recommend three Japanese films directed by Akira Kurosawa in the 1950s.”
- “Which films won Oscars at the 2020 ceremony?”

When you send a prompt, the server sends the current conversation to Gemini to generate the reply. With **Exclude watched films** enabled, the server also sends recent watched titles to Gemini and filters the results against your full watched list. The app stores up to 15 recent chats, your watchlist, and your watched films in this browser. Localhost and your Vercel site each have their own lists. Voice input fills the composer for review before sending. Speech recognition and microphone access depend on the browser.

## Build and serve

```sh
npm run build
npm start
```

The Node server serves the Vite build and API together. It listens on `127.0.0.1:4173` by default. Set `HOST` and `PORT` in the server environment to configure the listener.

The React interface lives in `src/`. The Node API, provider requests, recommendation matching, and rating integrations live in `server/`.

## Deploy to Vercel

1. Import the GitHub repository into Vercel with the repository root as the project directory. The included `vercel.json` selects Vite, runs `npm run build`, and serves `dist`.
2. Add your TMDB and Gemini credentials in the project's Environment Variables settings. Add OMDb and MDBList keys for their ratings and awards data. Apply the variables to Production and to Preview if you use preview deployments.
3. Deploy the commit that includes `api/` and `vercel.json`. After deployment, open `/api/home` on your deployed domain. You should see JSON with `providers.tmdb` and `providers.gemini` set to `true`. Then check movie lookup, a chat reply, and a direct link to a film or `/watchlist`.

If the homepage loads and `/api/home` returns Vercel's `404 NOT_FOUND`, check the deployment's source commit and root directory. The Vercel project needs the repository root with the API function files alongside the Vite project.

Vercel serves `api/` as Node functions, including the streaming search and chat endpoints. Provider timeouts, rate limits, and Gemini overload responses are always logged. Cache entries and rate counters live in each function instance. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) · [Vercel environment variables](https://vercel.com/docs/environment-variables)

### Chat metrics

Set `PROVIDER_METRICS=1` in the deployment environment to record successful requests alongside failures. From a linked checkout, summarize production logs with a current Vercel CLI. [Vercel CLI logs](https://vercel.com/docs/cli/logs)

```sh
vercel logs runtime --environment production --since 30m --query 'provider_request OR chat_request' --limit 10000 --json | node scripts/chat-metrics.js
```

The report shows the chat timeout rate for accepted requests, the Gemini timeout rate per provider attempt, and p50 and p95 server time to the first movie cards. Cancelled chats are counted separately. The script also accepts JSON lines from the local server.

## Credits

Film data and posters come from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. The bundled TMDB mark is by Travis Bell under CC BY-SA 4.0. [TMDB](https://www.themoviedb.org) · [Mark attribution](https://commons.wikimedia.org/wiki/File:Tmdb.new.logo.svg) · [License](https://creativecommons.org/licenses/by-sa/4.0/)

OMDb and MDBList supply additional ratings and awards data when configured. The hero artwork was generated for this project. [OMDb](https://www.omdbapi.com/) · [MDBList](https://mdblist.com/) · [Font licenses](public/fonts/)

Oscar verification uses a bundled export of the Academy Awards Database covering film-linked wins through the 98th ceremony in 2026. The export includes IMDb identifiers to distinguish films with the same title. Refresh it with `python3 scripts/build-oscar-winners.py /path/to/oscars.csv` after reviewing a newer upstream export against the Academy’s results. [Academy Awards Database](https://awardsdatabase.oscars.org/) · [Pinned export](https://github.com/DLu/oscar_data/tree/c5e9716b7e020e70205d6b95f5a5678526c1b45f) · [BSD 2-Clause license](server/data/oscar-data-LICENSE.txt)
