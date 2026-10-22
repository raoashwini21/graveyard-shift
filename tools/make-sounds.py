"""Render Graveyard Shift's sound effects from scratch.

Everything here is synthesised (noise, oscillators, filters, a convolution reverb), so the sounds are original
and free to ship. Run: python3 tools/make-sounds.py  ->  writes public/sfx/*.mp3 (needs numpy, scipy, ffmpeg).
"""
import os, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(13)

def t(sec): return np.arange(int(sec * SR)) / SR
def noise(sec): return rng.standard_normal(int(sec * SR))
def pink(sec):
    n = int(sec * SR); w = rng.standard_normal(n)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 4
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), x)
def env(n, a, d, curve=3.0):
    e = np.ones(n); A = max(1, int(a * SR)); e[:A] = np.linspace(0, 1, A) ** 2
    D = np.arange(n - A) / SR; e[A:] = np.exp(-D * curve / max(d, 1e-3)); return e
def resonator(x, f, q):
    b, a = signal.iirpeak(f, q, fs=SR); return signal.lfilter(b, a, x)
def pad(x, sec): return np.concatenate([x, np.zeros(int(sec * SR))])
def mix(*parts):
    n = max(len(p) for p in parts); out = np.zeros(n)
    for p in parts: out[:len(p)] += p
    return out
def at(x, sec, total):
    out = np.zeros(int(total * SR)); s = int(sec * SR); e = min(len(out), s + len(x)); out[s:e] += x[:e - s]; return out

def impulse(sec=2.6, bright=6000, seed=0):
    r = np.random.default_rng(seed); n = int(sec * SR); tt = np.arange(n) / SR
    chans = []
    for c in range(2):
        x = r.standard_normal(n) * np.exp(-tt * 6.5 / sec)
        # darker as it decays
        x = lp(x, bright) * 0.6 + lp(x, bright / 4) * 0.4
        x[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        chans.append(x)
    ir = np.stack(chans, 1); return ir / np.abs(ir).max()

def reverb(x, wet=0.35, sec=2.6, bright=6000):
    ir = impulse(sec, bright)
    dry = np.stack([x, x], 1)
    w = np.stack([signal.fftconvolve(x, ir[:, c])[:len(x) + len(ir) - 1] for c in range(2)], 1)
    w /= np.abs(w).max() + 1e-9
    dry = np.concatenate([dry, np.zeros((len(w) - len(dry), 2))])
    return dry * (1 - wet) + w * wet * np.abs(x).max()

def save(name, x, gain_db=-1.0, stereo_width=0.0):
    if x.ndim == 1: x = np.stack([x, x], 1)
    x = x - x.mean(0)
    peak = np.abs(x).max() + 1e-9
    x = x / peak * (10 ** (gain_db / 20))
    # tiny fade to avoid clicks
    f = int(0.004 * SR); x[:f] *= np.linspace(0, 1, f)[:, None]; x[-f:] *= np.linspace(1, 0, f)[:, None]
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        wavfile.write(tmp.name, SR, (x * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-codec:a', 'libmp3lame', '-q:a', '4', os.path.join(OUT, name + '.mp3')], check=True)
    os.unlink(tmp.name)
    print('wrote', name, f'{len(x) / SR:.1f}s')

# ---------- building blocks ----------
def creak(sec=1.5, f0=28, f1=70, seed=1):
    """Stick-slip friction: a jittery pulse train through wooden body resonances."""
    r = np.random.default_rng(seed); n = int(sec * SR); out = np.zeros(n)
    tt = np.linspace(0, 1, n)
    rate = f0 + (f1 - f0) * (np.sin(tt * np.pi * r.uniform(1.2, 2.2)) ** 2) + r.standard_normal(n).cumsum() / np.sqrt(n) * 25
    rate = np.clip(np.abs(rate), 8, 220)
    phase = np.cumsum(rate / SR)
    ticks = np.where(np.diff(np.floor(phase), prepend=0) > 0)[0]
    for k in ticks: out[k] += r.uniform(0.5, 1.0)
    body = sum(resonator(out, f, q) * g for f, q, g in [(380, 9, 1.0), (760, 12, 0.7), (1450, 14, 0.45), (2600, 18, 0.25)])
    body = lp(body, 2800, 4)
    amp = np.sin(np.linspace(0, np.pi, n)) ** 0.6 * (0.7 + 0.3 * np.sin(tt * 37))
    return body * amp

def bell(f, sec, partials=((1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)), decay=2.0, detune=0.0):
    tt = t(sec); x = np.zeros_like(tt)
    for m, g in partials: x += g * np.sin(2 * np.pi * f * m * (1 + detune) * tt) * np.exp(-tt * decay * m ** 0.5)
    return x

def whisper(sec=1.6, seed=3, pitch=1.0):
    """Breathy noise through moving vowel formants, chopped into syllables."""
    r = np.random.default_rng(seed); n = int(sec * SR); src = hp(noise(sec), 300)
    vowels = [(300, 870, 2240), (640, 1190, 2390), (440, 1020, 2240), (270, 2290, 3010), (570, 840, 2410)]
    seg = n // 6; out = np.zeros(n)
    for i in range(6):
        f1, f2, f3 = (v * pitch for v in vowels[r.integers(len(vowels))])
        s = src[i * seg:(i + 1) * seg]
        y = resonator(s, f1, 6) * 0.8 + resonator(s, f2, 8) * 0.6 + resonator(s, f3, 10) * 0.35 + hp(s, 4000) * 0.15
        e = np.sin(np.linspace(0, np.pi, len(y))) ** 1.5 * r.uniform(0.4, 1.0)
        out[i * seg:(i + 1) * seg] = y * e
    return lp(out, 7000)

def boom(sec=3.5, f0=55, f1=26):
    tt = t(sec); f = f1 + (f0 - f1) * np.exp(-tt * 3)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.3)
    hit = lp(noise(sec), 900) * np.exp(-tt * 18)
    return x + hit * 0.5

def strings(freqs, sec, swell=1.4, release=2.0, bright=1800):
    tt = t(sec); x = np.zeros_like(tt)
    for i, f in enumerate(freqs):
        vib = 1 + 0.004 * np.sin(2 * np.pi * (5 + i * 0.3) * tt + i)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        saw = sum(np.sin(ph * k) / k for k in range(1, 12))
        x += saw
    x = lp(x, bright)
    e = np.minimum(1, (tt / swell) ** 2) * np.where(tt > sec - release, np.exp(-(tt - (sec - release)) * 3), 1)
    return x * e

def reversed_swell(sec=1.2):
    tt = t(sec); x = bp(noise(sec), 400, 7000) * (tt / sec) ** 3
    return x

def chains(sec=1.4, seed=5):
    r = np.random.default_rng(seed); out = np.zeros(int(sec * SR))
    k = 0.02
    while k < sec - 0.2:
        clink = sum(np.sin(2 * np.pi * f * t(0.18)) * np.exp(-t(0.18) * r.uniform(25, 45)) for f in r.uniform(2200, 6800, 4))
        out = mix(out, at(clink * r.uniform(0.3, 1.0), k, sec))
        k += r.exponential(0.06)
    return out

def knock(n=3, gap=0.22):
    sec = n * gap + 0.4; out = np.zeros(int(sec * SR))
    for i in range(n):
        tt = t(0.25); th = (np.sin(2 * np.pi * 110 * tt) + 0.6 * np.sin(2 * np.pi * 190 * tt)) * np.exp(-tt * 30) + lp(noise(0.25), 1500) * np.exp(-tt * 60) * 0.8
        out = mix(out, at(th * (1 - i * 0.12), max(0, i * gap + rng.uniform(-0.015, 0.015)), sec))
    return out

# ---------- the sounds ----------
def ambience(sec=48):
    tt = t(sec); n = len(tt)
    w = pink(sec)
    centre = 520 + 260 * np.sin(2 * np.pi * tt / 13) + 140 * np.sin(2 * np.pi * tt / 5.3)
    wind = np.zeros(n); block = 2048
    for i in range(0, n, block):
        c = centre[i]; seg = w[max(0, i - 4096):i + block]
        y = bp(seg, c * 0.7, c * 1.4)[-min(block, n - i):]
        wind[i:i + len(y)] = y
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * tt / 9.1) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * tt / 3.7))
    wind = lp(wind * gust, 2500)
    drone = sum(g * np.sin(2 * np.pi * f * tt + p) for f, g, p in [(55, 1, 0), (55.35, 0.8, 1), (82.4, 0.35, 2), (110.6, 0.15, 3), (41.2, 0.5, 0.4)])
    drone *= 0.6 + 0.4 * np.sin(2 * np.pi * tt / 11) ** 2
    drone = lp(drone, 400)
    x = wind / np.abs(wind).max() * 0.9 + drone / np.abs(drone).max() * 0.45
    for k, s in [(7.5, 11), (21, 12), (34.5, 13)]:
        x = mix(x, at(creak(1.8, 18, 45, s) / 6, k, sec))
    for k in [15, 41]:
        x = mix(x, at(bell(196, 5, decay=0.8) * 0.12, k, sec))
    st = reverb(x, 0.3, 3.2, 3000)[:n]
    # make it loop: crossfade the last 3 seconds into the start
    f = 3 * SR; fade = np.linspace(0, 1, f)[:, None]
    st[:f] = st[:f] * fade + st[-f:] * (1 - fade)
    return st[:-f]

save('ambience', ambience(), -6)
save('creak', reverb(creak(1.6, 24, 75, 2), 0.35, 2.2, 4000), -2)
save('knock', reverb(knock(3), 0.3, 1.6, 3000), -2)

hb = np.zeros(int(2.4 * SR))
for k in [0, 0.82]:
    for d, g in [(0, 1.0), (0.2, 0.7)]:
        tt = t(0.3); th = np.sin(2 * np.pi * (48 + 30 * np.exp(-tt * 25)) * tt) * np.exp(-tt * 14)
        hb = mix(hb, at(th * g, k + d, 2.4))
save('heartbeat', reverb(lp(hb, 300), 0.2, 1.2, 800), -1)

rev = mix(at(reversed_swell(1.3) * 0.6, 0, 6.5), at(boom(5) * 1.2, 1.3, 6.5), at(strings([110, 116.5, 164.8, 174.6, 233.1], 4.8, 0.08, 3.6, 2600) * 0.28, 1.3, 6.5))
save('reveal', reverb(rev, 0.4, 3.5, 3500), -1)

stab = strings([880, 932, 1245, 1319, 1865], 1.2, 0.02, 1.0, 6000) + hp(noise(1.2), 3000) * np.exp(-t(1.2) * 6) * 2
save('scare', reverb(stab, 0.4, 2.0, 7000), -2)

# one sting per kind of ghost
dead = mix(at(reversed_swell(0.9) * 0.5, 0, 3), at(boom(2.2, 70, 34), 0.9, 3))
save('ghost-dead', reverb(dead, 0.35, 2.4, 3000), -2)
pos = mix(whisper(1.8, 4, 0.8) * 1.2, strings([98, 103.8], 1.8, 0.4, 1.0, 900) * 0.25)
save('ghost-possessed', reverb(pos, 0.45, 2.8, 5000), -2)
mb = np.zeros(int(2.6 * SR))
for i, (f, k) in enumerate([(1046.5, 0), (987.8 * 0.985, 0.32), (783.99 * 0.97, 0.66), (739.99 * 0.95, 1.05)]):
    mb = mix(mb, at(bell(f, 1.6, ((1, 1), (3.0, 0.3), (6.2, 0.1)), 3.0) * (1 - i * 0.15), k, 2.6))
save('ghost-past-event', reverb(mb, 0.45, 2.6, 6000), -3)
clock = np.zeros(int(3.0 * SR)); k = 0.0; g = 0.5
while k < 1.6:
    tick = bp(noise(0.03), 2000, 6000) * np.exp(-t(0.03) * 120) * (1 if int(k * 10) % 2 == 0 else 0.7)
    clock = mix(clock, at(tick, k, 3.0)); k += g; g *= 1.25
clock = mix(clock, at(bell(98, 2.2, decay=1.0) * 0.5, 1.4, 3.0))
save('ghost-stale-year', reverb(clock, 0.35, 2.4, 4000), -3)
save('ghost-nameless', reverb(mix(whisper(1.2, 8, 1.2) * 0.8, bell(1567, 1.6, ((1, 1), (2.01, 0.4)), 1.5) * 0.12), 0.5, 3.0, 6000), -3)
save('ghost-chain', reverb(chains(1.5) * 0.8, 0.35, 2.2, 6000), -3)
sh = hp(noise(1.3), 2500) * np.sin(np.linspace(0, np.pi, int(1.3 * SR))) ** 2
save('ghost-speechless', reverb(sh, 0.4, 2.2, 7000), -4)
save('ghost-locked', reverb(mix(knock(2, 0.18), at(chains(0.6, 9) * 0.4, 0.4, 1.2)), 0.35, 2.0, 4000), -3)

ban = mix(bp(noise(1.6), 300, 6000) * np.linspace(0, 1, int(1.6 * SR)) ** 2 * np.exp(-np.maximum(0, t(1.6) - 1.1) * 12) * 0.5,
          at(bell(1318.5, 2.0, ((1, 1), (2.0, 0.5), (3.01, 0.25)), 2.2) * 0.5, 0.9, 3),
          at(bell(1975.5, 1.8, ((1, 1), (2.0, 0.4)), 2.6) * 0.35, 1.05, 3))
save('banish', reverb(ban, 0.45, 2.8, 8000), -4)

# A tombstone heaving up out of the earth: low stone-on-stone grinding with gravel trickling off it.
# Its own random generator, so adding it never changes the sounds above.
def tomb_rise(sec=1.1, seed=21):
    r = np.random.default_rng(seed); n = int(sec * SR); tt = np.arange(n) / SR
    grind = lp(r.standard_normal(n).cumsum() / 60, 420, 4) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * tt + 1))
    grind = resonator(grind, 95, 3) * 0.7 + grind * 0.5
    grit = np.zeros(n)
    for k in r.choice(n - 2000, 70, replace=False):
        g = bp(r.standard_normal(1600), 1800, 6000) * np.exp(-np.arange(1600) / SR * 160) * r.uniform(0.1, 0.4)
        grit[k:k + 1600] += g
    shape = np.minimum(1, (tt / 0.25) ** 2) * np.exp(-np.maximum(0, tt - 0.75) * 9)
    return (grind + grit * 0.6) * shape
save('tomb-rise', reverb(tomb_rise(), 0.3, 1.8, 3000), -3)

# ...and settling into the ground: a heavy thud with a little earth spilling after it.
def tomb_land(seed=22):
    r = np.random.default_rng(seed); sec = 1.0; tt = np.arange(int(sec * SR)) / SR
    f = 38 + 50 * np.exp(-tt * 22)
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    hit = lp(r.standard_normal(len(tt)), 900) * np.exp(-tt * 45) * 0.6
    dirt = bp(r.standard_normal(len(tt)), 1500, 5000) * np.exp(-np.maximum(0, tt - 0.05) * 14) * (tt > 0.05) * 0.12
    return thud + hit + dirt
save('tomb-land', reverb(tomb_land(), 0.25, 1.4, 2500), -2)
