# FeelINFilm

FeelINFilm (FIF) helps you decide what to watch. Describe your mood, a film you liked, or the kind of movie you have in mind. You can also look up a title directly and explore its cast, ratings, trailers, and related films.

## Features

- **Conversational recommendations.** Gemini uses the current conversation to suggest films. FeelINFilm matches the picks against TMDB and checks supported constraints against the available data.
- **Refine your picks.** Ask a follow-up about genre, language, runtime, or release era. **More picks** keeps the current criteria and skips titles already suggested.
- **Movie lookup.** Search by title, browse weekly trending films, and open detail pages with cast, crew, release information, awards summaries, and trailers where available.
- **Linked ratings.** Compare IMDb, Rotten Tomatoes, and Letterboxd scores in compact badges on movie cards and detail pages. A dash marks an unavailable score.
- **Browser-local preferences.** Switch between light and dark themes, reopen recent conversations, or dictate a prompt in a browser that supports speech recognition.

## Quick start

Use Node.js 22.13 or newer.

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

The server keeps provider credentials out of the browser bundle. Movie lookup requires TMDB. Chat requires both Gemini and TMDB. If a configured Gemini model times out or hits a temporary provider limit, FeelINFilm can retry with Gemini Flash-Lite.

[TMDB credentials](https://developer.themoviedb.org/docs/getting-started) · [Gemini keys](https://aistudio.google.com/api-keys) · [OMDb keys](https://www.omdbapi.com/apikey.aspx) · [MDBList keys](https://docs.mdblist.com/docs/api)

## Try a prompt

- “I liked Arrival. Suggest thoughtful science fiction under two hours.”
- “Recommend three Japanese films directed by Akira Kurosawa in the 1950s.”
- “Which films won Oscars at the 2020 ceremony?”

When you send a prompt, the server sends the current conversation to Gemini to generate the reply. The app stores up to 15 recent chats in the current browser. You can delete them from the sidebar. Voice input fills the composer for review before sending. Speech recognition and microphone access depend on the browser.

## Build and serve

```sh
npm run build
npm start
```

The Node server serves the Vite build and API together. It listens on `127.0.0.1:4173` by default. Set `HOST` and `PORT` in the server environment to configure the listener.

The React interface lives in `src/`. The Node API, provider requests, recommendation matching, and rating integrations live in `server/`.

## Credits

Film data and posters come from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. The bundled TMDB mark is by Travis Bell under CC BY-SA 4.0. [TMDB](https://www.themoviedb.org) · [Mark attribution](https://commons.wikimedia.org/wiki/File:Tmdb.new.logo.svg) · [License](https://creativecommons.org/licenses/by-sa/4.0/)

OMDb and MDBList supply additional ratings and awards data when configured. The hero artwork was generated for this project. [OMDb](https://www.omdbapi.com/) · [MDBList](https://mdblist.com/) · [Font licenses](public/fonts/)
