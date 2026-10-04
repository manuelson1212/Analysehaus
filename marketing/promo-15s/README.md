# 15 s TikTok promo (9:16)

- `apex-wave-promo-15s.mp4`: final video with voice-over and music (H.264, 1080×1920, 30 fps, −14 LUFS).
- `apex-wave-promo-15s-music-only.mp4`: same video with music only, for recording your own voice-over.

## Rebuild

`python build.py --piper <piper> --voice en-us-ryan-high.onnx --work <scratch dir>` regenerates the voice clips,
the timeline, all frames, the soundtrack and both MP4 files. Edit `voiceover-lines.json` (spoken text) and
`scene.html` (on-screen text) first. Tickers are written as `B-T-C.` so the voice reads the letters.

## How it is made

1. **Voice-over**: Piper text-to-speech (free, runs locally), voice `en-us-ryan-high` from the rhasspy/piper releases.
   Lines are in `voiceover-lines.json`; each clip is trimmed and its start time stored in `timeline.json`.
2. **Picture**: `scene.html` draws every frame on a canvas from `timeline.json`, so each scene follows the voice exactly.
   `render.mjs` captures 450 frames with Playwright.
3. **Sound**: `audio.py` synthesizes the music bed, whooshes and impacts, places the voice clips, ducks the music
   under the voice and writes the mix plus stems.
4. **Encode**: ffmpeg combines frames and audio:
   `ffmpeg -framerate 30 -i frames/f%04d.jpg -i mix.wav -c:v libx264 -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out.mp4`
