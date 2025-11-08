# Realistic HDR Video Converter

Browser-based tool built with Next.js that transforms SDR footage into HDR-inspired video using WebAssembly-powered FFmpeg. All processing happens locally—no uploads to a backend server.

## Requirements

- Node.js 18+
- npm 9+ (or pnpm / yarn with equivalent support)

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser. The initial load includes downloading the FFmpeg WebAssembly assets, so the first conversion can take a moment.

## Production Build

```bash
npm run build
npm start
```

## Key Features

- Client-side HDR tone mapping via `@ffmpeg/ffmpeg`
- Adjustable HDR intensity and tone mapping curve
- Parallel source/HDR preview players
- Real-time FFmpeg processing log
- Downloadable 10-bit HEVC (`.mp4`) output
