import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.PIXAZO_API_KEY || "";
const GATEWAY = "https://gateway.pixazo.ai";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function requireKey(res) {
  if (!API_KEY) {
    res.status(500).json({
      error: "Missing API key",
      message:
        "Set the PIXAZO_API_KEY environment variable on the server (see README).",
    });
    return false;
  }
  return true;
}

// Strip empty/undefined fields so we only send what the user actually set
function cleanBody(body) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

const MODES = {
  "text-to-video": "/ltx-video/v1/text-to-video",
  "image-to-video": "/ltx-video/v1/image-to-video",
  "video-to-video": "/ltx-video/v1/video-to-video",
  "text-to-audio": "/tracks/v1/generate",
};

app.post("/api/generate/:mode", async (req, res) => {
  const { mode } = req.params;
  const upstreamPath = MODES[mode];
  if (!upstreamPath) {
    return res.status(400).json({ error: "Unknown mode", message: mode });
  }
  if (!requireKey(res)) return;

  try {
    const upstream = await fetch(`${GATEWAY}${upstreamPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": API_KEY,
      },
      body: JSON.stringify(cleanBody(req.body)),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream request failed", message: String(err) });
  }
});

// Flux 1 Schnell (free image) — this endpoint is synchronous: no QUEUED/PROCESSING
// polling, the response comes back with the finished image URL directly.
app.post("/api/image/generate", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const upstream = await fetch(`${GATEWAY}/flux-1-schnell/v1/getData`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": API_KEY,
      },
      body: JSON.stringify(cleanBody(req.body)),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream request failed", message: String(err) });
  }
});


app.get("/api/status/:requestId", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const upstream = await fetch(
      `${GATEWAY}/v2/requests/status/${encodeURIComponent(req.params.requestId)}`,
      { headers: { "Ocp-Apim-Subscription-Key": API_KEY } }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream request failed", message: String(err) });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, keyConfigured: Boolean(API_KEY) });
});

app.listen(PORT, () => {
  console.log(`LTX 2.3 studio running on port ${PORT}`);
});