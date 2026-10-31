"""Mixes the voiceover, the music and the sound effects the film declares (cues.json), and muxes them onto the render.
usage: python mix.py [silent.mp4] [out.mp4]   (after render.mjs and dump-cues.mjs)
Priority: voice > effects > music. The music ducks under the voice.
Effects: CC0 library in .agents/skills/sound-effects, plus two CC0 Freesound previews (ring, heartbeat).
Music: two Mixkit tracks (Mixkit Stock Music Free License), downloaded into audio-cache/, never committed."""
import json, subprocess, pathlib, sys
import numpy as np
here = pathlib.Path(__file__).parent
root = here.parents[3]
lib = root / ".agents/skills/sound-effects/sfx"
cache = here / "audio-cache"
SR = 48000
silent = here / (sys.argv[1] if len(sys.argv) > 1 else "draft_silent.mp4")
out = here / (sys.argv[2] if len(sys.argv) > 2 else "wasted-day.mp4")
FILES = {"tick": lib / "kit/tick.ogg", "click": lib / "kit/click.ogg", "pop": lib / "kit/pop.ogg", "whoosh": lib / "kit/whoosh.ogg", "riser": lib / "kit/riser.ogg",
         "impact": lib / "kit/impact.ogg", "ding": lib / "ding/fs-571513-soft-notifications-bell-ding-d.ogg", "glitch": lib / "glitch/kenney-interface-glitch-002.ogg",
         "ring": cache / "ring.mp3", "heart": cache / "heart.mp3"}
BASE_DB = {"tick": -23, "click": -17, "pop": -17, "whoosh": -16, "riser": -17, "impact": -11, "ding": -17, "glitch": -17, "ring": -15, "heart": -14}
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

timing = json.load(open(here / "timing.json"))
film = json.load(open(here / "cues.json"))
T, cues, dur = film["T"], film["cues"], film["duration"]
n = int(SR * dur)

# voice, with the silence beat cut in before the turn
vo = load(root / "public/assets/11labs-wasted-day.mp3", norm=False)
g = int(SR * timing["gap_at"])
vo = np.concatenate([vo[:g], np.zeros((int(SR * timing["gap"]), 2), np.float32), vo[g:]])
voice = np.zeros((n, 2), np.float32); put(voice, vo[:n] * 0.9, 0)

# how much the music ducks: a smoothed envelope of the voice
env = np.abs(voice).mean(1); w = int(SR * 0.2)
env = np.convolve(env, np.ones(w) / w, mode="same"); env = np.clip(env / (np.percentile(env, 95) or 1), 0, 1)
duck = db(-9 * env)[:, None]

music = np.zeros((n, 2), np.float32)
tense, warm = load(cache / "m723.mp3"), load(cache / "m834.mp3")
def seg(track, t0, t1, off, gain, fin=.4, fout=.05):
    a = track[int(SR * off) : int(SR * (off + t1 - t0))]
    put(music, fade(a, fin, fout) * db(gain), int(SR * t0))
seg(tense, 0, T["gone"], 8.0, -21, fin=.6, fout=.03)                                      # the grind and the wound, cut dead on "gone"
seg(tense, T["because"], timing["gap_at"] + .2, 8.0 + T["because"], -27, fin=.8, fout=1.2)  # the why, low, fading into the silence
warm_off = 38.0 - (T["called"] - T["if_"])                                                # the track's lift lands on "called him first"
seg(warm, T["if_"] - .05, dur, warm_off, -20, fin=.5, fout=1.4)
music *= duck

fx = np.zeros((n, 2), np.float32)
lib_cache = {k: load(v) for k, v in FILES.items()}
for c in cues:
    s, start = lib_cache[c["type"]], int(SR * c["t"])
    if c["type"] == "riser":                       # ends on its cue
        s = s[-int(SR * 1.9):]; start -= len(s); s = fade(s, 0, .08)
    elif c["type"] == "whoosh":                    # starts 2 frames early
        s = fade(s[: int(SR * .9)], 0, .08); start -= int(SR * .066)
    elif c["type"] == "ring":                      # one ring, cut when you pick up
        s = fade(s[int(SR * 1.25) : int(SR * 1.25) + int(SR * c["dur"])], .02, .06)
    elif c["type"] == "heart":                     # heartbeat under his words
        s = fade(np.tile(s, (int(c["dur"] / (len(s) / SR)) + 2, 1))[: int(SR * c["dur"])], .8, .5)
    put(fx, s * db(BASE_DB[c["type"]] + c.get("gain", 0)), start)

mix = voice + fx + music
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes()
(here / "mix.pcm").write_bytes(pcm)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", str(here / "mix.pcm"),
                "-af", "loudnorm=I=-15:TP=-2:LRA=9", "-ar", str(SR), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
(here / "mix.pcm").unlink()
print(out.name, "written,", len(cues), "cues")
