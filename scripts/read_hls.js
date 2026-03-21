const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../output');

function readHLSOutput(outputDir) {
  if (!fs.existsSync(outputDir)) {
    console.error(`output 폴더가 없습니다: ${outputDir}`);
    process.exit(1);
  }

  const videos = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(dir => {
      const videoDir = path.join(outputDir, dir.name);
      const files = fs.readdirSync(videoDir);

      const playlist = files.find(f => f.endsWith('.m3u8'));
      const segments = files.filter(f => f.endsWith('.ts'));

      if (!playlist) return null;

      const playlistPath = path.join(videoDir, playlist);
      const playlistContent = fs.readFileSync(playlistPath, 'utf-8');
      const duration = parseTotalDuration(playlistContent);

      return {
        name: dir.name,
        playlist: path.join(dir.name, playlist),
        segmentCount: segments.length,
        totalDuration: duration,
        size: getFolderSize(videoDir),
      };
    })
    .filter(Boolean);

  return videos;
}

function parseTotalDuration(m3u8Content) {
  const matches = m3u8Content.match(/#EXTINF:([\d.]+)/g) || [];
  const total = matches.reduce((sum, m) => sum + parseFloat(m.replace('#EXTINF:', '')), 0);
  return Math.round(total);
}

function getFolderSize(dirPath) {
  const files = fs.readdirSync(dirPath);
  const totalBytes = files.reduce((sum, file) => {
    const stat = fs.statSync(path.join(dirPath, file));
    return sum + stat.size;
  }, 0);
  return (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

// 실행
const results = readHLSOutput(OUTPUT_DIR);

if (results.length === 0) {
  console.log('변환된 HLS 파일이 없습니다. hls_convert.sh를 먼저 실행하세요.');
  process.exit(0);
}

console.log(`\n변환된 HLS 영상 목록 (${results.length}개)\n`);
console.log('─'.repeat(50));

results.forEach((video, i) => {
  console.log(`[${i + 1}] ${video.name}`);
  console.log(`    playlist  : output/${video.playlist}`);
  console.log(`    세그먼트  : ${video.segmentCount}개`);
  console.log(`    재생시간  : ${formatDuration(video.totalDuration)}`);
  console.log(`    폴더 크기 : ${video.size}`);
  console.log('─'.repeat(50));
});

module.exports = { readHLSOutput };
