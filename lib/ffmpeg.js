import ffmpegMain from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// Wire static binaries
if (ffmpegStatic) {
  ffmpegMain.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic && ffprobeStatic.path) {
  ffmpegMain.setFfprobePath(ffprobeStatic.path);
}

export function convertToWav16kMono(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpegMain(inputPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}

export function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpegMain(inputPath)
      .noVideo()
      .audioBitrate('192k')
      .format('mp3')
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}

export function ensureBinariesAvailable() {
  return Boolean(ffmpegStatic);
}

