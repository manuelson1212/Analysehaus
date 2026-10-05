"""Voice-over -> timeline -> soundtrack for the Bitcoin conspiracy short.
Usage: python tools/build.py --voice <de-thorsten-low.onnx> [--piper piper] [--work <scratch dir>]
Writes public/vo/*.wav, src/timeline.json, public/soundtrack.wav and public/music-only.wav.
Then render with: npx remotion render BitcoinVerschwoerung out/bitcoin-verschwoerung.mp4"""
import argparse, json, os, re, subprocess, tempfile

FPS = 30
LINE_GAP = 0.15   # pause between two lines of one scene
HOLD = 0.75       # scene keeps running after its last line, so the verdict stamp can be read
LEAD = 0.25       # next scene cuts in this long before its first word
OUTRO = 1.6       # final hold after the call to action
SPEED = 0.82      # piper length scale (lower = faster, punchier delivery)
TRIM = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,'
        'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse')

ap = argparse.ArgumentParser()
ap.add_argument('--voice', required=True); ap.add_argument('--piper', default='piper')
ap.add_argument('--work', default=tempfile.mkdtemp()); ap.add_argument('--python', default='python3')
a = ap.parse_args()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f'{root}/public/vo', exist_ok=True); os.makedirs(a.work, exist_ok=True)
script = json.load(open(f'{root}/script.json'))

def run(*cmd, **kw): return subprocess.run(cmd, check=True, **kw)
def dur(p): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p],
                                        capture_output=True, text=True, check=True).stdout)
def f(sec): return int(round(sec * FPS))

def words(text, start, end):
    """Spread a line's on-screen words over its spoken duration, weighted by length (Piper has no word timestamps)."""
    ws = text.split(); weights = [len(re.sub(r'\W', '', w)) + 2 for w in ws]
    total, t, out = sum(weights), start, []
    for w, wt in zip(ws, weights):
        d = (end - start) * wt / total; out.append({'text': w, 'from': f(t), 'to': f(t + d)}); t += d
    return out

t = 0.15; scenes = []; vo = []
for si, sc in enumerate(script['scenes']):
    scene_start = 0.0 if si == 0 else t - LEAD
    lines = []
    for li, line in enumerate(sc['lines']):
        key = f"{sc['id']}-{li}"; raw = f'{a.work}/{key}.wav'; clip = f'{root}/public/vo/{key}.wav'
        run(a.piper, '-m', a.voice, '--length-scale', str(SPEED), '-f', raw, input=line['say'].encode(), capture_output=True)
        run('ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', TRIM, '-ar', '44100', clip)
        d = dur(clip); s = t - scene_start
        lines.append({'key': key, 'show': line['show'], 'from': f(s), 'to': f(s + d), 'words': words(line['show'], s, s + d)})
        vo.append({'key': key, 'start': round(t, 3)})
        t += d + LINE_GAP
    t += -LINE_GAP + (OUTRO if si == len(script['scenes']) - 1 else HOLD + LEAD)
    end = t if si == len(script['scenes']) - 1 else t - LEAD
    scenes.append({'id': sc['id'], 'from': f(scene_start), 'durationInFrames': f(end) - f(scene_start),
                   'stamp': lines[-1]['to'] - f(0.55), 'lines': lines})

timeline = {'fps': FPS, 'durationInFrames': f(t), 'scenes': scenes}
json.dump(timeline, open(f'{root}/src/timeline.json', 'w'), indent=1, ensure_ascii=False)
json.dump({'total': t, 'fps': FPS, 'vo': vo, 'cuts': [s['from'] / FPS for s in scenes[1:]],
           'stamps': [(s['from'] + s['stamp']) / FPS for s in scenes[1:-1]]}, open(f'{a.work}/audio-plan.json', 'w'))
print(f'timeline: {t:.2f} s, {f(t)} frames, scenes: ' + ', '.join(f"{s['id']} {s['durationInFrames']}" for s in scenes))

run(a.python, f'{root}/tools/audio.py', f'{a.work}/audio-plan.json', f'{root}/public/vo', f'{a.work}/mix-raw.wav')
run('ffmpeg', '-v', 'error', '-y', '-i', f'{a.work}/mix-raw.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', '44100', f'{root}/public/soundtrack.wav')
run('ffmpeg', '-v', 'error', '-y', '-i', f'{a.work}/mix-raw-music.wav', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '44100', f'{root}/public/music-only.wav')
print('done')
