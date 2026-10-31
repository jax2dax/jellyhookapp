"""Builds set-rules.html from template.html: embeds the fonts, the logo and the word timings of the voiceover.
usage: python build.py   (run from this folder; words.json comes from the Whisper pass over set-rules.mp3)"""
import base64, json, pathlib
here = pathlib.Path(__file__).parent
b64 = lambda p: base64.b64encode((here / p).read_bytes()).decode()
fonts = "".join(
    f"@font-face{{font-family:'Space Grotesk';font-weight:{w};src:url(data:font/ttf;base64,{b64(f)}) format('truetype');}}\n"
    for w, f in [(500, "fonts/space1.ttf"), (700, "fonts/space2.ttf")]
)
segs = json.load(open(here / "words.json", encoding="utf-8"))
words = [{"w": w["w"].strip(), "s": w["s"], "e": w["e"], "seg": si} for si, s in enumerate(segs) for w in s["words"]]
json.dump({"gap_at": 0, "gap": 0}, open(here / "timing.json", "w"))
html = (here / "template.html").read_text(encoding="utf-8")
html = html.replace("/*@FONTS@*/", fonts).replace("/*@WORDS@*/null", json.dumps(words)).replace("@LOGO@", "data:image/png;base64," + b64("logo.png"))
(here / "set-rules.html").write_text(html, encoding="utf-8")
print("set-rules.html", len(html) // 1024, "KB,", len(words), "words")
