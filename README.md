# LTX 2.3 Studio

A small web app for generating video with the **free** LTX 2.3 API (text→video, image→video, video→video). Node/Express keeps your API key on the server; the browser never sees it.

## Run locally

```bash
npm install
export PIXAZO_API_KEY="your_subscription_key"
npm start
```

Open http://localhost:3000

## Deploy to Render

1. Push this folder to a GitHub repo.
2. In Render: **New → Web Service**, connect the repo (it will pick up `render.yaml` automatically — or set manually):
   - **Build command:** `npm install`
   - **Start command:** `npm start`
3. In the service's **Environment** tab, add:
   - `PIXAZO_API_KEY` = your Pixazo subscription key
4. Deploy. Render sets `PORT` automatically; the app reads it already.

## Files

- `server.js` — Express server, proxies `/api/generate/:mode` (video) and `/api/image/generate` (image) to `gateway.pixazo.ai` with your key attached server-side. `/api/upload` accepts a multipart file and returns a public URL (under `EXTERNAL_URL`) for use as `image_url`/`video_url`. `/api/audio/generate` is a stub — see below.
- `public/index.html` — the UI (single file, no build step). Tabs: Text→Video, Image→Video, Video→Video, Text→Image, Text→Audio.
- `render.yaml` — optional Render blueprint.

## Notes

- Image → Video and Video → Video support both a file picker and pasting a public URL. `image_url`/`video_url` **must be a public HTTPS URL** — Pixazo's gateway fetches it server-side, it does not accept base64 data URIs. Uploaded files are POSTed to `/api/upload`, saved under `uploads/` (gitignored, ephemeral storage), and served back at `${EXTERNAL_URL}/uploads/<file>` for the gateway to fetch. **`EXTERNAL_URL` must be set to this service's actual public URL (e.g. `https://pixazoltx.onrender.com`) or uploads will fail** — it's already required for the auto-pinger, so on Render just make sure the env var is set.
- Text → Image uses Flux 1 Schnell (free), which is **synchronous** — no polling, the response comes back with the finished image URL directly.
- Text → Audio (Pixazo Tracks) is not wired up yet: its exact gateway endpoint path wasn't published anywhere in Pixazo's public docs at the time this was built (unlike paid audio models such as Ace Step, which do have a documented path). Check your Pixazo dashboard's API reference once you have a key, then fill in the `TRACKS_PATH` in `server.js`'s `/api/audio/generate` route the same way the other routes are wired.
- The free tier is rate-limited (fair use) — if you get a 429, wait and retry.
- Video → Video's exact optional parameters weren't fully visible in the source docs beyond `prompt`, `video_url`, and `aspect`; the app also sends `strength` for it, but drop that field in `server.js`/`index.html` if the API rejects it.
