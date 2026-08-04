import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.PIXAZO_API_KEY || "";
const GATEWAY = "https://gateway.pixazo.ai";
const EXTERNAL_URL = process.env.EXTERNAL_URL || null;

// Pixazo's models fetch image_url/video_url themselves — they require a public
// HTTPS URL, not a base64 data URI. Uploaded files are written here temporarily
// and served back as a public URL under /uploads so the gateway can fetch them.
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100mb
});

// Auto-pinger: ping external URL every 14 minutes to keep the service awake
if (EXTERNAL_URL) {
  const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds
  console.log(`Auto-pinger enabled for ${EXTERNAL_URL} (every 14 minutes)`);
  
  // Initial ping after a short delay
  setTimeout(() => {
    fetch(EXTERNAL_URL, { method: "GET" })
      .then(res => console.log(`[Pinger] Initial ping: ${res.status}`))
      .catch(err => console.error(`[Pinger] Initial ping failed:`, err.message));
  }, 5000);
  
  // Recurring ping every 14 minutes
  setInterval(() => {
    fetch(EXTERNAL_URL, { method: "GET" })
      .then(res => console.log(`[Pinger] Pinged: ${res.status}`))
      .catch(err => console.error(`[Pinger] Failed:`, err.message));
  }, PING_INTERVAL);
}

app.use(express.json({ limit: "2mb" })); // no longer carries file data, base64 uploads go through /api/upload
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

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

// Accepts a multipart file upload and returns a public URL for it, since
// Pixazo's gateway fetches image_url/video_url itself — it can't accept
// base64 data URIs directly.
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!EXTERNAL_URL) {
    return res.status(500).json({
      error: "Missing EXTERNAL_URL",
      message:
        "Set the EXTERNAL_URL environment variable to this service's public URL (e.g. https://pixazoltx.onrender.com) so uploaded files can be served back to the Pixazo gateway.",
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const url = `${EXTERNAL_URL.replace(/\/$/, "")}/uploads/${req.file.filename}`;
  res.json({ url });
});

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