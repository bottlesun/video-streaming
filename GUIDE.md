# HLS 비디오 스트리밍 가이드

## 목차
1. [전체 흐름](#1-전체-흐름)
2. [FFmpeg 변환 상세](#2-ffmpeg-변환-상세)
3. [hls.js 플레이어](#3-hlsjs-플레이어)
4. [범용 활용 방법](#4-범용-활용-방법)
5. [CDN 연동 옵션](#5-cdn-연동-옵션)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. 전체 흐름

```
원본 영상 (.mp4 등)
    ↓
FFmpeg 변환 (hls_convert.sh)
    ↓
HLS 파일 생성
  ├── playlist.m3u8    ← 재생 목록 (인덱스)
  └── segment_000.ts  ← 실제 영상 조각 (10초 단위)
      segment_001.ts
      segment_002.ts
      ...
    ↓
(선택) CDN 업로드
    ↓
hls.js로 브라우저 재생
```

HLS(HTTP Live Streaming)는 영상을 작은 조각(segment)으로 나눠 HTTP로 전송하는 방식입니다.
덕분에 일반 웹 서버/CDN에서도 스트리밍이 가능하고, 네트워크 상태에 따라 화질을 자동 조절할 수 있습니다.

---

## 2. FFmpeg 변환 상세

### 기본 사용법
```bash
cd scripts
./hls_convert.sh /path/to/video.mp4
# 결과: output/video/playlist.m3u8
```

### 주요 FFmpeg 옵션 설명

| 옵션 | 설명 |
|------|------|
| `-codec: copy` | 영상/음성을 재인코딩 없이 복사 → 빠르고 화질 손실 없음 |
| `-hls_time 10` | 세그먼트 1개의 길이 (초). 낮을수록 초기 버퍼링 빠름 |
| `-hls_list_size 0` | m3u8에 모든 세그먼트 유지 (0 = 전체, VOD용) |
| `-start_number 0` | 세그먼트 번호 시작값 |

### 화질별 재인코딩이 필요한 경우
`-codec: copy` 대신 아래처럼 변경:
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -crf 23 -preset fast \
  -c:a aac -b:a 128k \
  -hls_time 10 -hls_list_size 0 \
  -f hls output/playlist.m3u8
```

---

## 3. hls.js 플레이어

`web/예시.html`은 hls.js를 사용한 기본 플레이어입니다.

### 핵심 코드 패턴
```javascript
const hls = new Hls();
hls.loadSource('playlist.m3u8');  // m3u8 경로 또는 URL
hls.attachMedia(videoElement);
hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
```

### 브라우저 지원
- **Chrome / Firefox / Edge** → hls.js 사용
- **Safari / iOS** → 네이티브 HLS 지원 (`video.src` 직접 설정)
- 예시.html은 두 경우 모두 자동 분기 처리됨

---

## 4. 범용 활용 방법

### 방법 A. 어댑티브 비트레이트 (ABR) — 화질 자동 전환

네트워크 속도에 따라 360p / 720p / 1080p 를 자동으로 전환합니다.
유튜브, 넷플릭스가 사용하는 방식입니다.

**변환 예시:**
```bash
ffmpeg -i input.mp4 \
  -map 0:v -map 0:a -map 0:v -map 0:a -map 0:v -map 0:a \
  -s:v:0 640x360   -b:v:0 400k  -s:v:1 1280x720  -b:v:1 1500k  -s:v:2 1920x1080 -b:v:2 4000k \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  -master_pl_name master.m3u8 \
  -f hls -hls_time 6 -hls_list_size 0 \
  -hls_segment_filename "output/stream_%v/seg_%03d.ts" \
  output/stream_%v/playlist.m3u8
```
→ `master.m3u8` 하나로 화질 자동 전환 재생

---

### 방법 B. 로컬 개발 서버로 테스트

브라우저 보안 정책(CORS)으로 로컬 파일을 직접 열면 재생 안 될 수 있습니다.
간단한 서버를 띄워서 테스트하세요:

```bash
# Python
python3 -m http.server 8080 --directory .

# Node.js (npx)
npx serve .
```
→ `http://localhost:8080/web/예시.html` 접속

---

### 방법 C. 라이브 스트리밍

카메라/화면 입력을 실시간으로 HLS 세그먼트로 내보냅니다:

```bash
ffmpeg -f avfoundation -i "0:0" \       # macOS 화면+마이크 캡처
  -c:v libx264 -preset ultrafast \
  -hls_time 2 -hls_list_size 5 \        # 최신 5개만 유지 (라이브용)
  -hls_flags delete_segments \          # 오래된 세그먼트 자동 삭제
  -f hls output/live/playlist.m3u8
```

---

### 방법 D. React / Next.js에 임베드

```bash
npm install hls.js
```

```jsx
import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

export default function HLSPlayer({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  }, [src]);

  return <video ref={videoRef} controls style={{ width: '100%' }} />;
}
```

---

### 방법 E. Vue / Nuxt에 임베드

```bash
npm install hls.js
```

**Vue 3 컴포넌트 (`components/HLSPlayer.vue`)**
```vue
<template>
  <video ref="videoRef" controls style="width: 100%" />
</template>

<script setup>
import Hls from 'hls.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ src: String })
const videoRef = ref(null)
let hls = null

onMounted(() => {
  const video = videoRef.value
  if (Hls.isSupported()) {
    hls = new Hls()
    hls.loadSource(props.src)
    hls.attachMedia(video)
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari 네이티브 HLS
    video.src = props.src
  }
})

onBeforeUnmount(() => hls?.destroy())
</script>
```

사용:
```vue
<HLSPlayer src="https://your-cdn.com/playlist.m3u8" />
```

**Nuxt 주의사항 — SSR에서 window 없음 오류 방지**

Nuxt는 기본적으로 SSR이라 `hls.js`가 서버에서 실행되면 에러가 납니다. 아래 두 방법 중 하나를 사용하세요.

방법 1 — `<ClientOnly>`로 감싸기 (가장 간단):
```vue
<ClientOnly>
  <HLSPlayer src="..." />
</ClientOnly>
```

방법 2 — `onMounted`에서 동적 import (컴포넌트 내부에서 처리):
```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ src: String })
const videoRef = ref(null)
let hls = null

onMounted(async () => {
  const { default: Hls } = await import('hls.js')
  const video = videoRef.value
  if (Hls.isSupported()) {
    hls = new Hls()
    hls.loadSource(props.src)
    hls.attachMedia(video)
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = props.src
  }
})

onBeforeUnmount(() => hls?.destroy())
</script>
```

> React(Next.js)와 난이도 차이 없음. Nuxt SSR 주의사항만 챙기면 동일하게 동작합니다.

---

### 방법 F. 자막(Subtitle) 추가

`.vtt` 자막 파일을 m3u8에 포함:

```bash
ffmpeg -i input.mp4 -i subtitle.srt \
  -c:v copy -c:a copy -c:s webvtt \
  -hls_time 10 -hls_list_size 0 \
  -f hls output/playlist.m3u8
```

---

## 5. CDN 연동 옵션

| CDN | 특징 | 명령어 |
|-----|------|--------|
| **AWS S3 + CloudFront** | 대용량, 안정적 | `aws s3 sync output/ s3://버킷명/output/` |
| **Cloudflare R2** | 무료 egress, S3 호환 | `rclone copy output/ r2:버킷명/output/` |
| **Firebase Storage** | 소규모 프로젝트 | `firebase deploy --only storage` |
| **Bunny CDN** | 저렴한 스트리밍 전용 | 웹 대시보드 업로드 |

업로드 후 `예시.html`의 src URL만 CDN 주소로 변경하면 됩니다.

---

## 6. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 로컬에서 재생 안 됨 | CORS 정책 | 방법 B처럼 로컬 서버 사용 |
| `codec not supported` | 컨테이너 불일치 | `-codec: copy` → `-c:v libx264` 로 재인코딩 |
| 세그먼트 누락 | 경로 오류 | m3u8과 .ts 파일이 같은 폴더인지 확인 |
| Safari에서 안 됨 | hls.js 미지원 | `canPlayType` 분기 처리 확인 |
| 라이브 딜레이 큼 | `hls_time` 값이 큼 | `hls_time 2` 이하로 줄이기 |
