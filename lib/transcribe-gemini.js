import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegMain from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { nanoid } from 'nanoid';

if (ffmpegStatic) ffmpegMain.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic && ffprobeStatic.path) ffmpegMain.setFfprobePath(ffprobeStatic.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_DIR = path.join(__dirname, '..', 'tmp');

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
const SINGLE_SHOT = String(process.env.SINGLE_SHOT ?? 'true').toLowerCase() === 'true';
const FALLBACK_AUTO_CHUNK = String(process.env.FALLBACK_AUTO_CHUNK ?? 'true').toLowerCase() === 'true';
const REQUEST_TIMEOUT_SEC = parseInt(process.env.REQUEST_TIMEOUT_SEC || '600', 10);

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente no ambiente');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

function toBase64(filePath) {
  const buf = fs.readFileSync(filePath);
  return buf.toString('base64');
}

function timeoutPromise(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), ms));
}

function isRetryableError(err) {
  const msg = String(err?.message || err || '');
  const status = err?.status || err?.response?.status;
  if (msg.includes('REQUEST_TIMEOUT')) return true;
  if (!status) return false;
  if (status === 413 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

async function callGeminiWithAudio(filePath, signal) {
  const model = getModel();
  const base64 = toBase64(filePath);
  const parts = [
    { text: 'Transcreva o áudio a seguir em português do Brasil (PT-BR) com alta acurácia e pontuação adequada. Responda somente com o texto puro da transcrição.' },
    { inlineData: { data: base64, mimeType: 'audio/wav' } }
  ];
  const p = model.generateContent({ contents: [{ role: 'user', parts }] });
  const res = await Promise.race([p, timeoutPromise(REQUEST_TIMEOUT_SEC * 1000)]);
  const text = res.response?.text ? res.response.text() : await res.text();
  return text;
}

async function splitWavToChunks(inputPath, chunkSeconds = 300) {
  await fsp.mkdir(TMP_DIR, { recursive: true });
  const prefix = `chunks-${nanoid(8)}`;
  const outDir = path.join(TMP_DIR, prefix);
  await fsp.mkdir(outDir, { recursive: true });
  const pattern = path.join(outDir, 'part-%03d.wav');

  await new Promise((resolve, reject) => {
    ffmpegMain(inputPath)
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .outputOptions([
        '-f', 'segment',
        '-segment_time', String(chunkSeconds),
        '-reset_timestamps', '1'
      ])
      .on('error', reject)
      .on('end', resolve)
      .save(pattern);
  });
  const files = (await fsp.readdir(outDir))
    .filter(f => f.endsWith('.wav'))
    .map(f => path.join(outDir, f))
    .sort();
  return { outDir, files };
}

export async function transcribeWithGemini(wavPath) {
  if (SINGLE_SHOT) {
    try {
      return await callGeminiWithAudio(wavPath);
    } catch (err) {
      if (!FALLBACK_AUTO_CHUNK || !isRetryableError(err)) throw err;
      // proceed to chunk mode
    }
  }

  // Chunked mode
  const { outDir, files } = await splitWavToChunks(wavPath, 300);
  let combined = '';
  try {
    for (const f of files) {
      try {
        const part = await callGeminiWithAudio(f);
        combined += (combined ? '\n' : '') + part.trim();
      } catch (err) {
        if (!isRetryableError(err)) throw err;
        // brief backoff then retry once
        await new Promise(r => setTimeout(r, 2000));
        const part = await callGeminiWithAudio(f);
        combined += (combined ? '\n' : '') + part.trim();
      }
    }
    return combined;
  } finally {
    // cleanup chunks dir
    try { await fsp.rm(outDir, { recursive: true, force: true }); } catch {}
  }
}

