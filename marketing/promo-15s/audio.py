"""Builds the soundtrack for the 15 s promo: synthesized music bed, transition whooshes and impacts,
plus the voice-over clips placed at the exact timeline positions, with ducking under the voice.
Usage: python audio.py <timeline.json> <vo_dir> <out.wav>
vo_dir must contain <key>-t.wav clips (trimmed piper output) for every timeline key."""
import json, subprocess, sys, wave
import numpy as np

SR = 44100
tl = json.load(open(sys.argv[1])); vo_dir = sys.argv[2]; out = sys.argv[3]
TOTAL = tl['total']; n = int(TOTAL * SR)
T_B = tl['intro']['start'] - 0.12; T_C = tl['btc']['start'] - 0.22; T_D = tl['zone']['start'] - 0.25; T_E = tl['cta']['start'] - 0.2
rng = np.random.default_rng(7)
t_all = np.arange(n) / SR
music = np.zeros((n, 2))

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= n: return
    sig = sig[: n - i]
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
    music[i:i + len(sig)] += sig * gain

def env(length, attack, release):
    m = int(length * SR); e = np.ones(m)
    a = int(attack * SR); r = int(release * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e

def spectral(sig, center, width):  # band-limited via FFT with a gaussian band
    f = np.fft.rfftfreq(len(sig), 1 / SR); S = np.fft.rfft(sig)
    S *= np.exp(-0.5 * ((np.log2(np.maximum(f, 1)) - np.log2(center)) / width) ** 2)
    return np.fft.irfft(S, len(sig))

def norm(x): return x / (np.max(np.abs(x)) + 1e-9)

def kick(dur=0.45):
    t = np.arange(int(dur * SR)) / SR
    f = 45 + 110 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + 0.15 * norm(spectral(rng.standard_normal(len(t)), 3000, 1)) * np.exp(-t * 60)

def boom(dur=1.6):
    t = np.arange(int(dur * SR)) / SR
    f = 32 + 60 * np.exp(-t * 6); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    nb = norm(spectral(rng.standard_normal(len(t)), 180, 1.2)) * np.exp(-t * 9) * 0.6
    return s + nb

def whoosh(dur=0.45, up=True):
    m = int(dur * SR); sig = np.zeros(m); parts = 6
    for k in range(parts):  # sweep the band centre in overlapping chunks
        c = 600 * (2 ** ((k if up else parts - 1 - k) * 0.6))
        a, b = int(k * m / parts), int(min(m, (k + 2) * m / parts))
        seg = norm(spectral(rng.standard_normal(b - a), c, 0.7)) * np.hanning(b - a)
        sig[a:b] += seg
    return norm(sig) * np.hanning(m) ** 0.7

def hat():
    t = np.arange(int(0.06 * SR)) / SR
    return norm(spectral(rng.standard_normal(len(t)), 9000, 0.6)) * np.exp(-t * 70)

def tone(freqs, dur, attack=0.3, release=0.6, detune=0.003, harmonics=3):
    t = np.arange(int(dur * SR)) / SR; s = np.zeros(len(t))
    for f in freqs:
        for d in (-detune, detune):
            for h in range(1, harmonics + 1):
                s += np.sin(2 * np.pi * f * (1 + d) * h * t) / (h * h)
    return norm(s) * env(dur, attack, release)

def pluck_bass(f, dur):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 7))
    bright = np.exp(-t * 9)
    return norm(s * (0.35 + 0.65 * bright)) * np.exp(-t * 3.2) * env(dur, 0.005, 0.05)

# 1) Hook: tension riser and nervous ticks
rt = t_all[: int(T_B * SR)]
riser = norm(spectral(rng.standard_normal(len(rt)), 1400, 1.0)) * (rt / T_B) ** 2 * 0.22
sweep = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2 * rt / T_B)) / SR) * (0.04 + 0.12 * (rt / T_B))
add(riser + sweep, 0)
for i, s in enumerate(np.arange(0.2, T_B - 0.1, 0.25)): add(hat(), s, 0.10 + 0.08 * (i % 2), pan=(-0.5 if i % 2 else 0.5))
add(whoosh(0.5, up=True)[::-1], T_B - 0.45, 0.5)  # reverse whoosh into the drop

# 2) Drop: impact, then 120 BPM groove (Am - F - C - G, one chord per bar)
add(boom(), T_B, 0.9)
beat = 0.5; chords = [([220.0, 261.63, 329.63], 55.0), ([174.61, 220.0, 261.63], 43.65), ([196.0, 261.63, 329.63], 65.41), ([196.0, 246.94, 293.66], 49.0)]
t0 = T_B
while t0 < T_E - 0.05:
    bar = int((t0 - T_B) / (beat * 4)) % 4; chord, root = chords[bar]
    k = int(round((t0 - T_B) / beat))
    add(kick(), t0, 0.75)
    add(hat(), t0 + beat / 2, 0.07, pan=0.4)
    if k % 4 == 0: add(tone(chord, min(beat * 4, T_E - t0) + 0.2, 0.25, 0.4), t0, 0.13)
    for e in (0, 0.25):  # eighth-note bass
        if t0 + e < T_E: add(pluck_bass(root * 2 if (k % 2 and e) else root, 0.24), t0 + e, 0.32)
    t0 += beat

# 3) Transitions
for s, up in [(T_C - 0.2, True), (T_D - 0.25, True)]: add(whoosh(0.5, up), s, 0.45)
for key in ['eth', 'sol', 'ndx', 'spx']: add(whoosh(0.32, True), tl[key]['start'] - 0.26, 0.25, pan=0.6)

# 4) CTA: impact, bright C major lift and a shimmering arpeggio
add(whoosh(0.6, True), T_E - 0.45, 0.5); add(boom(2.0), T_E, 0.8)
add(tone([261.63, 329.63, 392.0, 523.25], TOTAL - T_E, 0.08, 0.8, harmonics=4), T_E, 0.16)
arp = [523.25, 659.25, 783.99, 1046.5]
for i, s in enumerate(np.arange(T_E + 0.1, TOTAL - 0.2, 0.125)):
    tt = np.arange(int(0.25 * SR)) / SR
    add(np.sin(2 * np.pi * arp[i % 4] * tt) * np.exp(-tt * 14), s, 0.06, pan=(-0.6 + 1.2 * ((i % 4) / 3)))
for s in np.arange(T_E + 0.5, TOTAL - 0.3, 0.5): add(kick(), s, 0.45)

# 5) Voice-over: polished with ffmpeg, placed at the timeline positions
vo = np.zeros(n)
for key, span in tl.items():
    if key == 'total': continue
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{vo_dir}/{key}-t.wav', '-af',
        'aresample=44100,highpass=f=75,equalizer=f=160:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=3.5,equalizer=f=7500:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=4',
        '-f', 'f32le', '-ac', '1', '-'], capture_output=True, check=True).stdout
    clip = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    i = int(span['start'] * SR); vo[i:i + len(clip)] += clip[: n - i]
vo = norm(vo) * 0.92

# 6) Duck the music under the voice (fast attack, slow release)
level = np.abs(vo)
w = int(0.03 * SR); level = np.convolve(level, np.ones(w) / w, mode='same'); level = norm(level)
duck = np.zeros(n); g = 0.0
for i in range(0, n, 64):
    target = min(1.0, level[i] * 3)
    g += (target - g) * (0.5 if target > g else 0.02)
    duck[i:i + 64] = g
music *= (1 - 0.6 * duck)[:, None]
music = music / (np.max(np.abs(music)) + 1e-9) * 0.55

def write(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())

# Stems: music without voice (to record your own voice-over on top) and the voice alone.
write(out.replace('.wav', '-music.wav'), music)
write(out.replace('.wav', '-voice.wav'), np.stack([vo, vo], axis=1) * 0.95)

mix = music + np.stack([vo, vo], axis=1) * 0.95
fade = env(TOTAL, 0.01, 0.35)[:n]; mix *= fade[:, None]
mix = np.tanh(mix * 1.1) * 0.95  # gentle soft clip
write(out, mix)
print('wrote', out, f'{TOTAL}s')
