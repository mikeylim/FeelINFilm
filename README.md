# FeelINFilm

FeelINFilm (FIF) helps you decide what to watch. Describe your mood, a film you liked, or the kind of movie you have in mind. You can also look up a title directly and explore its cast, ratings, trailers, and related films.

## Features

- **Conversational recommendations.** Gemini uses the current conversation to suggest films. FeelINFilm matches the picks against TMDB and checks supported constraints against the available data.
- **Refine your picks.** Ask a follow-up about genre, language, runtime, or release era. **More picks** keeps the current criteria and skips titles already suggested.
- **Movie lookup.** Search by title or browse weekly trending films. Cards appear as soon as TMDB returns them, and ratings fill in afterward. Open a detail page for cast, crew, release information, awards summaries, and trailers where available.
- **Linked ratings.** Compare IMDb, Rotten Tomatoes, and Letterboxd scores in compact badges on movie cards and detail pages. A dash marks an unavailable score.
- **Guest watchlist.** Save films from lookup, recommendations, or detail pages and revisit them from the sidebar.
- **Browser-local preferences.** Switch between light and dark themes, reopen recent conversations, or dictate a prompt in a browser that supports speech recognition.

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
| `GEMINI_MODEL` | Optional model override. The default is `gemini-3.1-flash-lite`. |
| `OMDB_API_KEY` | Optional. Provides IMDb scores and awards summaries where available. |
| `MDBLIST_API_KEY` | Optional. Provides Letterboxd and Tomatometer scores and film links where available. It can also supply IMDb scores. |
| `PROVIDER_METRICS` | Optional. Set to `1` to log provider timings and the server time to prepare the first batch of movie cards. |

The server keeps provider credentials out of the browser bundle. Movie lookup requires TMDB. Chat requires both Gemini and TMDB. Chat allows one retry for a timeout or temporary provider failure, using Gemini Flash-Lite for the retry. A rate limit on a different model can switch to Flash-Lite. Gemini attempts share a 40-second budget, and the full chat request has a 54-second deadline that includes film matching and ratings.

[TMDB credentials](https://developer.themoviedb.org/docs/getting-started) · [Gemini keys](https://aistudio.google.com/api-keys) · [OMDb keys](https://www.omdbapi.com/apikey.aspx) · [MDBList keys](https://docs.mdblist.com/docs/api)

## Try a prompt

- “I liked Arrival. Suggest thoughtful science fiction under two hours.”
- “Recommend three Japanese films directed by Akira Kurosawa in the 1950s.”
- “Which films won Oscars at the 2020 ceremony?”

When you send a prompt, the server sends the current conversation to Gemini to generate the reply. The app stores up to 15 recent chats and your watchlist in this browser. Each site address has its own list, so localhost and your Vercel site store separate watchlists. Voice input fills the composer for review before sending. Speech recognition and microphone access depend on the browser.

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

Vercel serves `api/` as Node functions, including the streaming search and chat endpoints. With `PROVIDER_METRICS=1`, the function logs include provider durations, the Gemini model used, and time to prepare the first movie cards. Provider timeouts and rate limits are always logged. Cache entries and rate counters live in each function instance. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) · [Vercel environment variables](https://vercel.com/docs/environment-variables)

## Credits

Film data and posters come from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. The bundled TMDB mark is by Travis Bell under CC BY-SA 4.0. [TMDB](https://www.themoviedb.org) · [Mark attribution](https://commons.wikimedia.org/wiki/File:Tmdb.new.logo.svg) · [License](https://creativecommons.org/licenses/by-sa/4.0/)

OMDb and MDBList supply additional ratings and awards data when configured. The hero artwork was generated for this project. [OMDb](https://www.omdbapi.com/) · [MDBList](https://mdblist.com/) · [Font licenses](public/fonts/)
