"""One-command build of the 15 s promo: voice clips -> timeline -> frames -> soundtrack -> MP4.
Usage: python build.py --piper <piper-bin> --voice <model.onnx> --work <scratch dir>
Needs: Piper TTS, Node with Playwright (render.mjs), ffmpeg, numpy (audio.py)."""
import argparse, json, os, shutil, subprocess

ap = argparse.ArgumentParser()
ap.add_argument('--piper', required=True); ap.add_argument('--voice', required=True); ap.add_argument('--work', required=True)
ap.add_argument('--python', default='python3'); ap.add_argument('--node', default='node')
ap.add_argument('--render', default=None, help='render.mjs to use (a copy where Playwright is installed)')
a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__)); W = a.work; os.makedirs(f'{W}/vo', exist_ok=True)
lines = json.load(open(f'{here}/voiceover-lines.json'))
# Speaking speed per line (lower = faster); tightened lines keep the total at 15 s.
SPEED = {'intro': 0.8, 'spx': 0.8, 'cta': 0.76, 'btc': 0.85, 'eth': 0.85, 'sol': 0.85}
TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse'

def run(*cmd, **kw): return subprocess.run(cmd, check=True, **kw)
def dur(p): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True, check=True).stdout)

for k, text in lines.items():
    run(a.piper, '-m', a.voice, '--length-scale', str(SPEED.get(k, 0.9)), '-f', f'{W}/vo/{k}.wav', input=text.encode(), capture_output=True)
    run('ffmpeg', '-v', 'error', '-y', '-i', f'{W}/vo/{k}.wav', '-af', TRIM, f'{W}/vo/{k}-t.wav')

order = [('hook', 0.1), ('intro', 0.14), ('btc', 0.14), ('eth', 0.1), ('sol', 0.1), ('ndx', 0.1), ('spx', 0.1), ('zone', 0.14), ('target', 0.07), ('inval', 0.07), ('cta', 0.12)]
t, tl = 0.0, {}
for k, gap in order:
    d = dur(f'{W}/vo/{k}-t.wav'); t += gap; tl[k] = {'start': round(t, 3), 'end': round(t + d, 3)}; t += d
tl['total'] = 15.0
if tl['cta']['end'] > 14.95: raise SystemExit(f"voice-over too long: ends at {tl['cta']['end']} s")
json.dump(tl, open(f'{here}/timeline.json', 'w'), indent=1)
print({k: v for k, v in tl.items() if k != 'total'})

shutil.rmtree(f'{W}/frames', ignore_errors=True)
run(a.node, a.render or f'{here}/render.mjs', f'{here}/timeline.json', f'{W}/frames')
run(a.python, f'{here}/audio.py', f'{here}/timeline.json', f'{W}/vo', f'{W}/mix-raw.wav')
run('ffmpeg', '-v', 'error', '-y', '-i', f'{W}/mix-raw.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', '44100', f'{W}/mix.wav')
run('ffmpeg', '-v', 'error', '-y', '-i', f'{W}/mix-raw-music.wav', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '44100', f'{W}/music.wav')
# H.264 Main 4.0 + AAC: plays on every phone and uploads cleanly to TikTok and Instagram.
for audio, name in [('mix.wav', 'apex-wave-promo-15s.mp4'), ('music.wav', 'apex-wave-promo-15s-music-only.mp4')]:
    run('ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'{W}/frames/f%04d.jpg', '-i', f'{W}/{audio}', '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '4.0',
        '-preset', 'slow', '-crf', '20', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
        '-shortest', '-movflags', '+faststart', '-tag:v', 'avc1', f'{here}/{name}')
print('done')
