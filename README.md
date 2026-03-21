# HLS Video Streaming

FFmpeg으로 로컬 변환 → CDN 업로드 → hls.js로 재생하는 HLS 스트리밍 프로젝트.

## 폴더 구조

```
video-streaming/
├── scripts/
│   └── hls_convert.sh   # FFmpeg HLS 변환 스크립트
├── output/              # 변환된 HLS 파일 저장 위치
└── web/
    └── index.html       # hls.js 플레이어
```

## 사용 방법

### 1. 변환
```bash
cd scripts
chmod +x hls_convert.sh
./hls_convert.sh /path/to/video.mp4
# output/<video명>/playlist.m3u8 생성됨
```

<!-- ### 2. CDN 업로드
`output/` 폴더의 `.m3u8` 및 `.ts` 파일을 CDN에 업로드합니다. -->

### 3. 재생
`web/예시.html`을 브라우저에서 열기 — 로컬 `output/` 경로로 재생 예시 포함.
