import 'dotenv/config';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { nanoid } from 'nanoid';
import cron from 'node-cron';

import { convertToWav16kMono, convertToMp3 } from './lib/ffmpeg.js';
import { transcribeWithGemini } from './lib/transcribe-gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '2000', 10);
const TTL_HOURS = parseInt(process.env.TTL_HOURS || '2', 10);
const TMP_DIR = path.join(__dirname, 'tmp');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure dirs
for (const d of [TMP_DIR, PUBLIC_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `${nanoid(10)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 }
});

// In-memory jobs
const jobs = new Map();

function buildPaths(id) {
  return {
    src: path.join(TMP_DIR, `${id}.src`),
    wav: path.join(TMP_DIR, `${id}.wav`),
    mp3: path.join(TMP_DIR, `${id}.mp3`),
    txt: path.join(TMP_DIR, `${id}.txt`),
  };
}

function buildDownloads(id) {
  return {
    wav: `/download/${id}/wav`,
    mp3: `/download/${id}/mp3`,
    txt: `/download/${id}/txt`,
  };
}

async function processJob(job) {
  const { id, paths } = job;
  try {
    job.status = 'processing';
    // Convert to WAV 16k mono
    await convertToWav16kMono(paths.src, paths.wav);
    // MP3 copy for convenient download
    await convertToMp3(paths.src, paths.mp3);

    job.status = 'transcribing';
    const transcript = await transcribeWithGemini(paths.wav);
    await fsp.writeFile(paths.txt, transcript, 'utf8');

    job.status = 'completed';
    job.completedAt = Date.now();
  } catch (err) {
    job.status = 'error';
    job.error = String(err && err.message ? err.message : err);
  }
}

app.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const source = (req.body?.source || 'mic').toString();
    if (!req.file) return res.status(400).json({ error: 'Arquivo de áudio não enviado' });

    const id = nanoid(12);
    const p = buildPaths(id);

    // Move uploaded file to normalized name
    await fsp.copyFile(req.file.path, p.src);
    try { await fsp.unlink(req.file.path); } catch {}

    const job = {
      id,
      source,
      createdAt: Date.now(),
      status: 'queued',
      paths: p,
      gcsObject: null,
      gcsUri: null,
      error: null
    };
    jobs.set(id, job);

    // Fire and forget
    processJob(job);

    res.json({ id, status: job.status, downloads: buildDownloads(id), message: 'Upload recebido. Iniciando processamento.' });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/status/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ID não encontrado' });
  const info = {
    id: job.id,
    status: job.status,
    error: job.error || null,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
    downloads: buildDownloads(job.id)
  };
  res.json(info);
});

app.get('/download/:id/:type', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send('ID não encontrado');
  const t = (req.params.type || '').toLowerCase();
  let filePath, filename, contentType;
  if (t === 'wav') { filePath = job.paths.wav; filename = `${job.id}.wav`; contentType = 'audio/wav'; }
  else if (t === 'mp3') { filePath = job.paths.mp3; filename = `${job.id}.mp3`; contentType = 'audio/mpeg'; }
  else if (t === 'txt') { filePath = job.paths.txt; filename = `${job.id}.txt`; contentType = 'text/plain; charset=utf-8'; }
  else return res.status(400).send('Tipo inválido');

  try {
    await fsp.access(filePath, fs.constants.R_OK);
  } catch {
    return res.status(404).send('Arquivo não disponível');
  }
  res.setHeader('Content-Type', contentType);
  res.download(filePath, filename);
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Cleanup: every 10 minutes, delete local files and GCS older than 2h
const RETENTION_MS = TTL_HOURS * 60 * 60 * 1000;
cron.schedule('*/10 * * * *', async () => {
  const now = Date.now();
  for (const [id, job] of Array.from(jobs.entries())) {
    if (now - job.createdAt < RETENTION_MS) continue;
    // Remove local files
    for (const p of [job.paths?.src, job.paths?.wav, job.paths?.mp3, job.paths?.txt]) {
      if (!p) continue;
      try { await fsp.unlink(p); } catch {}
    }
    jobs.delete(id);
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});
