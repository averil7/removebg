const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const TEMP_DIR = "/tmp/bg-remover";
const EXPIRY_MS = 20 * 60 * 1000; // 20 menit

// Pastikan folder temp ada
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Multer — simpan ke memory, maks 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Hanya file JPG, PNG, dan WebP yang diperbolehkan"));
  },
});

// ─── Helper: baca metadata dari file .meta.json ───────────────────────────────
// Di Vercel, in-memory store hilang setiap invocation.
// Solusi: simpan metadata ke file .meta.json berdampingan dengan file gambar.

function metaPath(id) {
  return path.join(TEMP_DIR, `${id}.meta.json`);
}

function readMeta(id) {
  try {
    const raw = fs.readFileSync(metaPath(id), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeMeta(id, data) {
  fs.writeFileSync(metaPath(id), JSON.stringify(data), "utf8");
}

function deleteMeta(id) {
  try { fs.unlinkSync(metaPath(id)); } catch {}
}

function deleteFile(id) {
  try { fs.unlinkSync(path.join(TEMP_DIR, `${id}.png`)); } catch {}
  deleteMeta(id);
}

// Lazy cleanup: hapus file lama saat ada request masuk
function lazyCleanup() {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    files
      .filter(f => f.endsWith(".meta.json"))
      .forEach(f => {
        const id = f.replace(".meta.json", "");
        const meta = readMeta(id);
        if (meta && now > meta.expiresAt) {
          deleteFile(id);
        }
      });
  } catch {}
}

// ─── POST /api/remove-bg ──────────────────────────────────────────────────────
app.post("/api/remove-bg", upload.single("image"), async (req, res) => {
  lazyCleanup();

  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diunggah" });
  }

  try {
    const { removeBackground } = await import("@imgly/background-removal-node");

    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const resultBlob = await removeBackground(blob, {
      model: "small",
      output: { format: "image/png", quality: 0.9 },
    });

    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

    const id = uuidv4();
    const filePath = path.join(TEMP_DIR, `${id}.png`);
    fs.writeFileSync(filePath, resultBuffer);

    const expiresAt = Date.now() + EXPIRY_MS;
    writeMeta(id, { expiresAt, originalName: req.file.originalname });

    const base64 = resultBuffer.toString("base64");

    return res.json({
      success: true,
      id,
      downloadUrl: `/api/download/${id}`,
      expiresIn: 20 * 60,
      expiresAt: new Date(expiresAt).toISOString(),
      previewBase64: `data:image/png;base64,${base64}`,
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Gagal memproses gambar: " + err.message });
  }
});

// ─── GET /api/download/:id ────────────────────────────────────────────────────
app.get("/api/download/:id", (req, res) => {
  const { id } = req.params;
  const meta = readMeta(id);

  if (!meta) {
    return res.status(404).json({ error: "File tidak ditemukan atau sudah kadaluarsa" });
  }

  if (Date.now() > meta.expiresAt) {
    deleteFile(id);
    return res.status(410).json({ error: "File sudah kadaluarsa (lebih dari 20 menit)" });
  }

  const filePath = path.join(TEMP_DIR, `${id}.png`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File tidak ditemukan" });
  }

  const baseName = path.basename(meta.originalName, path.extname(meta.originalName));
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}-no-bg.png"`);
  res.setHeader("Content-Type", "image/png");
  res.sendFile(filePath);
});

// ─── GET /api/status/:id ──────────────────────────────────────────────────────
app.get("/api/status/:id", (req, res) => {
  const { id } = req.params;
  const meta = readMeta(id);

  if (!meta) return res.json({ exists: false });

  const now = Date.now();
  if (now > meta.expiresAt) {
    deleteFile(id);
    return res.json({ exists: false, expired: true });
  }

  return res.json({
    exists: true,
    expiresIn: Math.floor((meta.expiresAt - now) / 1000),
    expiresAt: new Date(meta.expiresAt).toISOString(),
  });
});

module.exports = app;
