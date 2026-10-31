"""Builds wasted-day.html from template.html: embeds the fonts, the logo and the word timings of the voiceover.
usage: python build.py   (run from this folder; words.json comes from the Whisper pass over the mp3)"""
import base64, json, pathlib
here = pathlib.Path(__file__).parent
b64 = lambda p: base64.b64encode((here / p).read_bytes()).decode()
fonts = "".join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};src:url(data:font/ttf;base64,{b64(f)}) format('truetype');}}\n"
    for fam, w, f in [("Young Serif", 400, "fonts/young.ttf"), ("Albert Sans", 500, "fonts/albert500.ttf"), ("Albert Sans", 700, "fonts/albert700.ttf")]
)
# a beat of silence is cut into the voice before the turn ("If you had Jelly Hook"); mix.py inserts the same gap
TIMING = {"gap_at": 35.45, "gap": 0.45}
json.dump(TIMING, open(here / "timing.json", "w"))
shift = lambda x: x + TIMING["gap"] if x >= TIMING["gap_at"] else x
segs = json.load(open(here / "words.json", encoding="utf-8"))
words = []
for si, s in enumerate(segs):
    for w in s["words"]:
        words.append({"w": w["w"].strip(), "s": round(shift(w["s"]), 3), "e": round(shift(w["e"]), 3), "seg": si})
html = (here / "template.html").read_text(encoding="utf-8")
html = html.replace("/*@FONTS@*/", fonts).replace("/*@WORDS@*/null", json.dumps(words)).replace("@LOGO@", "data:image/png;base64," + b64("logo.png"))
(here / "wasted-day.html").write_text(html, encoding="utf-8")
print("wasted-day.html", len(html) // 1024, "KB,", len(words), "words")
