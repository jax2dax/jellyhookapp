"""Mixes the voiceover, the music and the sound effects the film declares (cues.json), and muxes them onto the render.
usage: python mix.py   (after render.mjs wrote draft_silent.mp4 and dump-cues.mjs wrote cues.json)
Priority: voice > effects > music. The music ducks under the voice.
Effects: CC0 library in .agents/skills/sound-effects, plus CC0 Freesound previews (ring, splash, phone buzz).
Music: two Mixkit tracks (Mixkit Stock Music Free License), downloaded into audio-cache/, never committed."""
import json, subprocess, pathlib
import numpy as np
here = pathlib.Path(__file__).parent
root = here.parents[3]
lib = root / ".agents/skills/sound-effects/sfx"
cache = here / "audio-cache"
SR = 48000
silent, out = here / "draft_silent.mp4", here / "set-rules.mp4"
FILES = {"tick": lib / "kit/tick.ogg", "click": lib / "kit/click.ogg", "pop": lib / "kit/pop.ogg", "whoosh": lib / "kit/whoosh.ogg", "riser": lib / "kit/riser.ogg",
         "impact": lib / "kit/impact.ogg", "ding": lib / "ding/fs-571513-soft-notifications-bell-ding-d.ogg",
         "ring": cache / "ring.mp3", "splash": cache / "splash.mp3", "buzz": cache / "buzz.mp3"}
BASE_DB = {"tick": -23, "click": -17, "pop": -17, "whoosh": -16, "riser": -17, "impact": -11, "ding": -17, "ring": -15, "splash": -14, "buzz": -10}
db = lambda d: 10 ** (d / 20)

def load(p, norm=True):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
    return a / (np.abs(a).max() or 1) * 0.9 if norm else a
def fade(a, fin=0.0, fout=0.0):
    a = a.copy()
    if fin: k = min(len(a), int(SR * fin)); a[:k] *= np.linspace(0, 1, k)[:, None]
    if fout: k = min(len(a), int(SR * fout)); a[-k:] *= np.linspace(1, 0, k)[:, None]
    return a
def put(mix, s, start):
    a, b = max(0, start), min(len(mix), start + len(s))
    if b > a: mix[a:b] += s[a - start : b - start]

film = json.load(open(here / "cues.json"))
T, cues, dur = film["T"], film["cues"], film["duration"]
n = int(SR * dur)
vo = load(root / "public/assets/set-rules.mp3", norm=False)
voice = np.zeros((n, 2), np.float32); put(voice, vo[:n] * 0.9, 0)
env = np.abs(voice).mean(1); w = int(SR * 0.2)
env = np.convolve(env, np.ones(w) / w, mode="same"); env = np.clip(env / (np.percentile(env, 95) or 1), 0, 1)
duck = db(-9 * env)[:, None]

music = np.zeros((n, 2), np.float32)
tense, bright = load(cache / "m140.mp3"), load(cache / "m702.mp3")
def seg(track, t0, t1, off, gain, fin=.4, fout=.05):
    a = track[int(SR * off) : int(SR * (off + t1 - t0))]
    put(music, fade(a, fin, fout) * db(gain), int(SR * t0))
seg(tense, 0, T["with_"] - .02, 6.0, -20, fin=.5, fout=.03)          # the pile: cut dead when the logo lands
seg(bright, T["with_"] - .02, dur, 0.0, -20, fin=.05, fout=1.6)      # the rules: brighter from "With JellyHook"
music *= duck

fx = np.zeros((n, 2), np.float32)
lib_cache = {k: load(v) for k, v in FILES.items()}
for c in cues:
    s, start = lib_cache[c["type"]], int(SR * c["t"])
    if c["type"] == "riser":
        s = fade(s[-int(SR * 1.9):], 0, .08); start -= len(s)
    elif c["type"] == "whoosh":
        s = fade(s[: int(SR * .9)], 0, .08); start -= int(SR * .066)
    elif c["type"] == "ring":
        s = fade(s[int(SR * 1.25) : int(SR * 1.25) + int(SR * c["dur"])], .02, .06)
    elif c["type"] == "splash":
        s = fade(s[: int(SR * 1.3)], 0, .3)
    elif c["type"] == "buzz":
        s = fade(s, 0, .1)
    put(fx, s * db(BASE_DB[c["type"]] + c.get("gain", 0)), start)

mix = voice + fx + music
(here / "mix.pcm").write_bytes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", str(here / "mix.pcm"),
                "-af", "loudnorm=I=-15:TP=-2.5:LRA=9,alimiter=limit=0.85:level=disabled", "-ar", str(SR), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
(here / "mix.pcm").unlink()
print(out.name, "written,", len(cues), "cues")
