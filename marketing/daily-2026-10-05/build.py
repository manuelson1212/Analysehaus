"""Builds the daily analysis video (5 Oct 2026): voice clips -> timeline -> frames -> soundtrack -> MP4.
Usage: python build.py --piper <piper-bin> --voice <de-thorsten-low.onnx> --work <scratch dir> --python <python with numpy>\nPronunciation fixes use Piper's phoneme syntax [[ ... ]] in voiceover-lines.json."""
import argparse, json, os, shutil, subprocess

ap = argparse.ArgumentParser()
ap.add_argument('--piper', required=True); ap.add_argument('--voice', required=True); ap.add_argument('--work', required=True)
ap.add_argument('--python', default='python3'); ap.add_argument('--node', default='node'); ap.add_argument('--render', default=None)
a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__)); W = a.work; os.makedirs(f'{W}/vo', exist_ok=True)
lines = json.load(open(f'{here}/voiceover-lines.json'))
SPEED = {'ma': 0.8, 'hist': 0.8, 'cta': 0.8}  # lower = faster; keeps the voice-over near 30 s
TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse'
NAME = 'apex-wave-tagesanalyse-2026-10-05'

def run(*cmd, **kw): return subprocess.run(cmd, check=True, **kw)
def dur(p): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True, check=True).stdout)

for k, text in lines.items():
    run(a.piper, '-m', a.voice, '--length-scale', str(SPEED.get(k, 0.84)), '-f', f'{W}/vo/{k}.wav', input=text.encode(), capture_output=True)
    run('ffmpeg', '-v', 'error', '-y', '-i', f'{W}/vo/{k}.wav', '-af', TRIM, f'{W}/vo/{k}-t.wav')

order = [('hook', 0.25), ('ma', 0.22), ('q3', 0.22), ('hist', 0.22), ('key', 0.22), ('macro', 0.25), ('cta', 0.3)]
t, tl = 0.0, {}
for k, gap in order:
    d = dur(f'{W}/vo/{k}-t.wav'); t += gap; tl[k] = {'start': round(t, 3), 'end': round(t + d, 3)}; t += d
tl['total'] = round(t + 1.1, 2)  # hold the call to action
json.dump(tl, open(f'{here}/timeline.json', 'w'), indent=1)
print({k: v for k, v in tl.items()})

shutil.rmtree(f'{W}/frames', ignore_errors=True)
run(a.node, a.render or f'{here}/render.mjs', f'{here}/timeline.json', f'{W}/frames')
# Voice only (no music, no effects): audio.py places the clips on the timeline and writes the voice stem.
run(a.python, f'{here}/audio.py', f'{here}/timeline.json', f'{W}/vo', f'{W}/mix-raw.wav')
run('ffmpeg', '-v', 'error', '-y', '-i', f'{W}/mix-raw-voice.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7', '-ar', '44100', f'{W}/voice.wav')
run('ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'{W}/frames/f%04d.jpg', '-i', f'{W}/voice.wav', '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '4.0',
    '-preset', 'slow', '-crf', '20', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-shortest', '-movflags', '+faststart', '-tag:v', 'avc1', f'{here}/{NAME}.mp4')
print('done')
