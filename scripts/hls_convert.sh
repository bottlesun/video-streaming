#!/bin/bash
# HLS 변환 스크립트
# 사용법: ./hls_convert.sh <input_video> [output_dir]

INPUT="$1"
OUTPUT_DIR="${2:-../output}"

if [ -z "$INPUT" ]; then
  echo "사용법: $0 <input_video> [output_dir]"
  exit 1
fi

BASENAME=$(basename "$INPUT" | sed 's/\.[^.]*$//')
HLS_DIR="$OUTPUT_DIR/$BASENAME"

mkdir -p "$HLS_DIR"

echo "변환 시작: $INPUT → $HLS_DIR"

ffmpeg -i "$INPUT" \
  -codec: copy \
  -start_number 0 \
  -hls_time 10 \
  -hls_list_size 0 \
  -hls_segment_filename "$HLS_DIR/segment_%03d.ts" \
  -f hls \
  "$HLS_DIR/playlist.m3u8"

echo "변환 완료: $HLS_DIR/playlist.m3u8"
