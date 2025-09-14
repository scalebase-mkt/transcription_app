import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';
import speech from '@google-cloud/speech';

const { SpeechClient } = speech;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNTIME_TMP = path.join(__dirname, '..', 'tmp');

let initialized = false;

export function initGoogle() {
  if (initialized) return;
  if (!fs.existsSync(RUNTIME_TMP)) fs.mkdirSync(RUNTIME_TMP, { recursive: true });

  const inlineCreds = process.env.GOOGLE_CLOUD_CREDENTIALS;
  if (inlineCreds && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = path.join(RUNTIME_TMP, 'gcp-sa.json');
    fs.writeFileSync(credPath, inlineCreds, 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  }
  initialized = true;
}

export function getClients() {
  initGoogle();
  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const speechClient = new SpeechClient({ projectId: process.env.GCP_PROJECT_ID });
  return { storage, speech: speechClient };
}

export async function uploadToGCS(storage, bucketName, localPath, destination, contentType = 'audio/wav') {
  const bucket = storage.bucket(bucketName);
  await bucket.upload(localPath, {
    destination,
    resumable: true,
    metadata: {
      contentType,
      cacheControl: 'no-store'
    }
  });
  return `gs://${bucketName}/${destination}`;
}

export async function transcribeGCS(speechClient, gcsUri) {
  const request = {
    audio: { uri: gcsUri },
    config: {
      languageCode: 'pt-BR',
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      enableAutomaticPunctuation: true,
      useEnhanced: true,
      // model: 'latest_long', // Uncomment if your project has access
    }
  };

  const [operation] = await speechClient.longRunningRecognize(request);
  const [response] = await operation.promise();

  const chunks = [];
  for (const result of response.results || []) {
    const alt = result.alternatives && result.alternatives[0];
    if (alt && alt.transcript) chunks.push(alt.transcript);
  }
  return chunks.join('\n');
}

export async function deleteFromGCS(storage, bucketName, destination) {
  try {
    const bucket = storage.bucket(bucketName);
    await bucket.file(destination).delete({ ignoreNotFound: true });
    return true;
  } catch {
    return false;
  }
}

