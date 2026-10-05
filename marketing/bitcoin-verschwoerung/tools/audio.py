"""Soundtrack for the Bitcoin conspiracy short: synthesized dark trap bed, whooshes on every cut,
impacts on every verdict stamp, voice-over placed from the plan and ducked music.
Usage: python audio.py <audio-plan.json> <vo_dir> <out.wav>  (also writes <out>-music.wav)"""
import json, sys, wave
import numpy as np

SR = 44100
plan = json.load(open(sys.argv[1])); vo_dir = sys.argv[2]; out = sys.argv[3]
TOTAL = plan['total']; n = int(TOTAL * SR); cuts = plan['cuts']; stamps = plan['stamps']
DROP, CTA = cuts[0], cuts[-1]
rng = np.random.default_rng(21)
music = np.zeros((n, 2))

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= n or i < 0: return
    sig = sig[: n - i]
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
    music[i:i + len(sig)] += sig * gain

def env(length, attack, release):
    m = int(length * SR); e = np.ones(m)
    a = min(m, int(attack * SR)); r = min(m, int(release * SR))
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e

def band(sig, center, width):  # gaussian band-pass in the log-frequency domain
    fr = np.fft.rfftfreq(len(sig), 1 / SR); S = np.fft.rfft(sig)
    S *= np.exp(-0.5 * ((np.log2(np.maximum(fr, 1)) - np.log2(center)) / width) ** 2)
    return np.fft.irfft(S, len(sig))

def norm(x): return x / (np.max(np.abs(x)) + 1e-9)
def noise(sec): return rng.standard_normal(int(sec * SR))
def tt(sec): return np.arange(int(sec * SR)) / SR

def kick():
    t = tt(0.35); fq = 48 + 120 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(fq) / SR) * np.exp(-t * 9) + 0.2 * norm(band(noise(0.35), 3500, 1)) * np.exp(-t * 80)

def sub808(f, sec):
    t = tt(sec); fq = f * (1 + 0.6 * np.exp(-t * 40))
    s = np.sin(2 * np.pi * np.cumsum(fq) / SR); s = np.tanh(s * 1.8)
    return s * np.exp(-t * 1.6) * env(sec, 0.004, 0.06)

def clap():
    t = tt(0.3); s = norm(band(noise(0.3), 1600, 0.8))
    e = sum(np.exp(-np.maximum(t - d, 0) * 60) * (t >= d) for d in (0, 0.011, 0.022)) * np.exp(-t * 14)
    return s * e

def hat(sec=0.05):
    t = tt(sec); return norm(band(noise(sec), 9500, 0.5)) * np.exp(-t * 90)

def boom(sec=1.8):
    t = tt(sec); fq = 30 + 70 * np.exp(-t * 7)
    s = np.sin(2 * np.pi * np.cumsum(fq) / SR) * np.exp(-t * 2.2)
    return s + norm(band(noise(sec), 200, 1.3)) * np.exp(-t * 8) * 0.7

def hit():  # verdict stamp: short punchy impact with a metallic click
    t = tt(0.6); body = np.sin(2 * np.pi * np.cumsum(70 + 160 * np.exp(-t * 30)) / SR) * np.exp(-t * 8)
    click = norm(band(noise(0.6), 4200, 0.6)) * np.exp(-t * 70)
    ring = np.sin(2 * np.pi * 1870 * t) * np.exp(-t * 18) * 0.25
    return norm(body + 0.8 * click + ring)

def whoosh(sec=0.45, up=True):
    m = int(sec * SR); sig = np.zeros(m); parts = 6
    for k in range(parts):
        c = 500 * (2 ** ((k if up else parts - 1 - k) * 0.65))
        a, b = int(k * m / parts), int(min(m, (k + 2) * m / parts))
        sig[a:b] += norm(band(rng.standard_normal(b - a), c, 0.7)) * np.hanning(b - a)
    return norm(sig) * np.hanning(m) ** 0.7

def pad(freqs, sec):
    t = tt(sec); s = np.zeros(len(t))
    for fq in freqs:
        for d in (-0.004, 0.0, 0.004):
            s += np.sin(2 * np.pi * fq * (1 + d) * t + rng.uniform(0, 6)) + 0.3 * np.sin(4 * np.pi * fq * (1 + d) * t)
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * 0.5 * t)
    return norm(s) * trem * env(sec, 0.4, 0.5)

def bell(fq, sec=1.2):
    t = tt(sec); return (np.sin(2 * np.pi * fq * t) + 0.4 * np.sin(2 * np.pi * fq * 2.76 * t)) * np.exp(-t * 4)

# 1) Hook: heartbeat, rising noise and a reverse whoosh into the drop
rt = tt(DROP)
add(norm(band(noise(DROP), 1500, 1.0)) * (rt / DROP) ** 2.5 * 0.2, 0)
add(np.sin(2 * np.pi * np.cumsum(70 * 2 ** (2.5 * rt / DROP)) / SR) * (0.03 + 0.1 * rt / DROP), 0)
for s in np.arange(0.05, DROP - 0.3, 0.8):
    add(kick() * 0.6, s, 0.55); add(kick() * 0.4, s + 0.22, 0.4)
add(pad([146.83, 174.61, 220.0], DROP), 0, 0.08)
add(whoosh(0.55, True)[::-1], DROP - 0.5, 0.55)

# 2) Groove: 140 BPM half-time trap, Dm - Bb - Gm - A
beat = 60 / 140; step = beat / 4; bar = beat * 4
chords = [([293.66, 349.23, 440.0], 36.71), ([233.08, 293.66, 349.23], 29.14), ([196.0, 233.08, 293.66], 49.0), ([220.0, 277.18, 329.63], 55.0)]
melody = [587.33, 698.46, 880.0, 698.46]
add(boom(2.2), DROP, 0.9)
b = 0; t0 = DROP
while t0 < CTA - 0.05:
    chord, root = chords[b % 4]
    add(pad(chord, min(bar, CTA - t0) + 0.3), t0, 0.07)
    add(sub808(root, min(bar * 0.62, CTA - t0)), t0, 0.42)
    add(sub808(root, min(bar * 0.3, max(0.05, CTA - t0 - step * 10))), t0 + step * 10, 0.3)
    for k in range(16):
        s = t0 + k * step
        if s >= CTA - 0.02: break
        if k in (0, 10) or (b % 2 and k == 7): add(kick(), s, 0.7)
        if k == 8: add(clap(), s, 0.38)
        if k % 2 == 0: add(hat(), s, 0.07 + 0.03 * (k % 4 == 0), pan=0.35)
        if b % 4 == 3 and k >= 12: add(hat(0.03), s + step / 2, 0.05, pan=-0.35)  # roll into the next bar
        if k == 0: add(bell(melody[b % 4]), s, 0.05, pan=-0.3)
    b += 1; t0 += bar

# 3) Cuts and verdict stamps
for c in cuts: add(whoosh(0.4, True), c - 0.3, 0.4, pan=0.2)
for s in stamps: add(hit(), s, 0.55)

# 4) Call to action: impact, open chord and a slow bell motif
add(boom(2.4), CTA, 0.8)
add(pad([293.66, 349.23, 440.0, 587.33], TOTAL - CTA), CTA, 0.12)
for i, s in enumerate(np.arange(CTA + 0.2, TOTAL - 0.6, beat * 2)): add(bell([587.33, 440.0, 523.25, 440.0][i % 4]), s, 0.06)

# Voice-over and ducking
vo = np.zeros(n)
for item in plan['vo']:
    with wave.open(f"{vo_dir}/{item['key']}.wav") as w:
        assert w.getframerate() == SR, 'vo clips must be 44.1 kHz'
        d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        if w.getnchannels() == 2: d = d.reshape(-1, 2).mean(axis=1)
    i = int(item['start'] * SR); d = d[: n - i]; vo[i:i + len(d)] += d
vo = norm(vo) * 0.9
level = np.convolve(np.abs(vo), np.ones(2048) / 2048, mode='same'); level = norm(level)
duck = np.zeros(n); g = 0.0
for i in range(0, n, 64):
    target = min(1.0, level[i] * 3); g += (target - g) * (0.5 if target > g else 0.02); duck[i:i + 64] = g
music *= (1 - 0.55 * duck)[:, None]
music = music / (np.max(np.abs(music)) + 1e-9) * 0.5

def write(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as fh:
        fh.setnchannels(2); fh.setsampwidth(2); fh.setframerate(SR); fh.writeframes(pcm.tobytes())

fade = env(TOTAL, 0.01, 0.5)[:n]
write(out.replace('.wav', '-music.wav'), music * fade[:, None])
mix = (music + np.stack([vo, vo], axis=1)) * fade[:, None]
write(out, np.tanh(mix * 1.1) * 0.95)
print('wrote', out, f'{TOTAL:.2f}s')
