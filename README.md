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

- `server.js` — Express server, proxies `/api/generate/:mode` and `/api/status/:id` to `gateway.pixazo.ai` with your key attached server-side.
- `public/index.html` — the UI (single file, no build step).
- `render.yaml` — optional Render blueprint.

## Notes

- Image → Video and Video → Video require a **publicly accessible** URL for the source image/video (upload it somewhere first — this app doesn't host files).
- The free tier is rate-limited (fair use) — if you get a 429, wait and retry.
- Video → Video's exact optional parameters weren't fully visible in the source docs beyond `prompt`, `video_url`, and `aspect`; the app also sends `strength` for it, but drop that field in `server.js`/`index.html` if the API rejects it.
