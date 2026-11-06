# marketing/business-hunting/scan.py
# Reads a business website and reports what scoring.md needs:
#   - forms: form tools, and per form whether it has an open "what do you want" box (textarea / message) and a
#     "which service" picker (select). This feeds C8.
#   - depth: pages in the sitemap, words and subheadings on up to 6 service-like pages, and pages about concerns
#     (FAQ, process, cost, financing, warranty, comparisons). This feeds C9.
#   - self-serve signs, prices on the home page, call to action words, tracking stack.
# Usage: python -I scan.py out.json                       (the sample below)
#        python -I scan.py out.json example.com ...        (any sites you pass)
#        python -I scan.py out.json --file wave.json       (a wave: {"type": ["domain", ...], ...})
# Forms that load with JavaScript (HubSpot embeds, many builders) cannot be read: "fields unknown" means "not seen".
# Open the site to confirm before scoring C8.
import re, sys, json, ssl, statistics, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

SITES = {
 "Design-build remodeler": ["neilkelly.com","lamontbros.com","mosaikdesign.com","squaredealremodeling.com","amplifiedrenovations.com"],
 "Custom pool builder": ["anthonysylvan.com","alliedoutdoorsolutions.com","poolsxdesign.com","selahpools.com"],
 "Residential AV / smart home": ["pureavcorp.com","dreamediaav.com","aimhomeautomation.com","electronicintegration.com"],
 "Wedding / event venue": ["theestateyountville.com","charleskrug.com","pineridgevineyards.com"],
 "Senior living": ["aegisliving.com","bayviewseattle.org","leisurecare.com"],
 "Private K-12 school": ["brimmer.org","dextersouthfield.org","isbos.org","milton.edu"],
 "Personal injury law": ["forthepeople.com","avrek.com","theadvocates.com","zaneslaw.com"],
 "Custom luxury travel": ["abercrombiekent.com","foresttravel.com","theafricaspecialists.com","tcsworldtravel.com"],
 "Addiction treatment": ["passagesmalibu.com"],
 "Residential solar": ["solarmaxtech.com","solaroptimum.com","gogreensolar.com"],
 "Franchisor (franchise sales)": ["sendmeapro.com","homesmiles.com","terraceup.com"],
 "Commercial AV integrator": ["avispl.com","fordav.com","avdg.com","pavion.com"],
 "Custom software agency": ["brainvire.com","cygnismedia.com","weblineindia.com","thoughtbot.com","8thlight.com"],
 "Commercial cleaning": ["vanguardcleaning.com","janiking.com","morfincleaning.com","jan-pro.com"],
 "Trade show exhibit builder": ["absoluteexhibits.com","exponents.com","pureexhibits.com"],
 "Corporate event production": ["raybloch.com","voloevents.com","eventsolutions.com"],
 "Fund / advisory platform": ["ppbcapitalpartners.com"],
}

if len(sys.argv) > 3 and sys.argv[2] == "--file":
    SITES = json.load(open(sys.argv[3], encoding="utf-8"))
elif len(sys.argv) > 2:
    SITES = {"adhoc": sys.argv[2:]}

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE

def get(url, limit=2_500_000):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xml"})
        with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
            return r.geturl(), r.read(limit).decode("utf-8", "ignore")
    except Exception:
        return None, ""

FORM_TOOLS = {
 "hubspot-form": r"hbspt\.forms|hsforms\.(net|com)|hs-form", "gravity": r"gform_wrapper|gform_", "cf7": r"wpcf7",
 "wpforms": r"wpforms", "ninja": r"nf-form", "elementor": r"elementor-form", "jotform": r"jotform", "typeform": r"typeform",
 "formstack": r"formstack", "pardot": r"pardot|pi\.pardot|go\.pardot", "marketo-form": r"mktoForm", "tripleseat": r"tripleseat",
 "honeybook": r"honeybook", "wix-form": r"wixforms|wix-forms", "webflow-form": r"w-form",
}
SELF_SERVE = {"calendly": r"calendly\.com", "acuity": r"acuityscheduling", "cart/checkout": r"add[-_ ]to[-_ ]cart|/checkout", "opentable/resy": r"opentable|resy\.com"}
STACK = {"HubSpot": r"js\.hs-scripts\.com|js\.hsforms|hs-analytics", "Salesforce/Pardot": r"pardot|salesforce\.com/servlet", "Marketo": r"munchkin|mktoForm",
         "CallRail": r"callrail", "Hotjar": r"hotjar", "MS Clarity": r"clarity\.ms", "GTM/GA": r"googletagmanager|gtag\(", "Chat widget": r"intercom|drift\.com|livechat|tawk\.to|podium|birdeye|olark|zendesk"}
CTA = ["free consultation","consultation","request a quote","get a quote","free quote","free estimate","estimate","schedule a tour","book a tour","inquire","enquire",
       "case evaluation","request information","request info","start a project","tell us about your project","contact us","get started","start planning","apply","book now","buy now","pricing"]
SERVICE_WORDS = r"service|solution|program|offering|what-we-do|capabilit|venue|care|practice|amenit|itinerar|destination|kitchen|bath|addition|theater|automation|pool|wedding|event|cleaning|exhibit|rental|admission|academ|injur|accident|solar|battery|franchise|industr|living|memory|residential|commercial|treatment|product|system|install|repair|design|build|plan"
CONCERN_WORDS = r"faq|question|how-it-works|how-we-work|our-process|process|what-to-expect|cost|price|pricing|financ|warrant|guarantee|compare|-vs-|versus|guide|myth|mistake|before-you|choosing|insurance|timeline|permit"
SKIP_WORDS = r"blog/|news/|tag/|category/|author/|page/\d|privacy|terms|login|cart|careers|jobs|wp-|feed|sitemap|contact"
OPEN_BOX = r"message|how can we help|tell us|describe|comment|detail|question|inquiry|enquiry|note|project|what are you|anything else|how did|reason"
PICKER = r"service|interest|inquiry|enquiry|type|program|reason|topic|department|product|looking for|help with|project"

def internal_links(base, html):
    host = urllib.parse.urlparse(base).netloc.replace("www.", "")
    out = set()
    for h in re.findall(r'href=["\']([^"\'#?]+)', html, re.I):
        u = urllib.parse.urljoin(base, h)
        p = urllib.parse.urlparse(u)
        if p.netloc.replace("www.", "") == host and not re.search(r"\.(jpg|jpeg|png|gif|pdf|css|js|svg|webp|ico|xml|mp4)$", p.path, re.I):
            path = p.path.rstrip("/")
            if path and path.count("/") <= 4:
                out.add(path.lower())
    return out

def lead_forms(html):
    """Each real form (not search/newsletter/login) -> fields, open box, service picker."""
    out = []
    for attrs, body in re.findall(r"<form\b([^>]*)>(.*?)</form>", html, re.I | re.S):
        f = attrs + body
        if re.search(r'type=["\']search|role=["\']search|name=["\']s["\']|newsletter|subscribe|password', f, re.I):
            continue
        fields = re.findall(r"<(input|textarea|select)\b([^>]*)>", body, re.I)
        visible = [a for t, a in fields if not re.search(r'type=["\'](hidden|submit|button|checkbox|radio)', a, re.I)]
        if len(visible) < 2:
            continue
        has_textarea = bool(re.search(r"<textarea", body, re.I))
        selects = re.findall(r"<select\b([^>]*)>(.*?)</select>", body, re.I | re.S)
        labels = " ".join(re.findall(r"<label[^>]*>(.*?)</label>", body, re.I | re.S)).lower()
        picker = any(re.search(PICKER, a + " " + o[:600], re.I) and o.count("<option") >= 3 for a, o in selects)
        out.append({"fields": len(visible), "open_box": has_textarea or bool(re.search(r"how can we help|tell us about|your message", labels)),
                    "service_picker": picker, "labels": re.sub(r"<[^>]+>|\s+", " ", labels)[:200].strip()})
    return out

def text_of(html):
    h = re.sub(r"(?is)<(script|style|noscript|svg|nav|header|footer|form)\b.*?</\1>", " ", html)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h))

# Words a buyer uses while deciding (not while admiring): money, risk, terms, time, comparison.
DECISION_WORDS = r"\b(fee|fees|cost|costs|price|pricing|budget|financ\w*|payment|deposit|contract|agreement|cancel\w*|refund|warrant\w*|guarantee\w*|insur\w*|liabilit\w*|risk\w*|timeline|how long|permit\w*|compare|comparison|versus|vs\.?|alternative\w*|downside\w*|mistake\w*|what happens|eligib\w*|requirement\w*|qualif\w*)\b"

def depth_of(html):
    t = text_of(html)
    words = len(re.findall(r"[A-Za-z]{2,}", t))
    heads = re.findall(r"<h[234]\b[^>]*>(.*?)</h[234]>", html, re.I | re.S)
    qheads = sum(1 for h in heads if re.sub(r"<[^>]+>", "", h).strip().endswith("?"))
    paras = len([p for p in re.findall(r"<p\b[^>]*>(.*?)</p>", html, re.I | re.S) if len(re.sub(r"<[^>]+>", "", p).split()) >= 40])
    dec = len(re.findall(DECISION_WORDS, t, re.I))
    return words, len(heads), paras, qheads, round(1000 * dec / max(words, 1), 1)

def sitemap_urls(base):
    urls, todo, seen = [], [urllib.parse.urljoin(base, p) for p in ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]], set()
    while todo and len(seen) < 8:
        sm = todo.pop(0)
        if sm in seen:
            continue
        seen.add(sm)
        _, x = get(sm, 3_000_000)
        if "<loc>" not in x:
            continue
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", x)
        if "<sitemapindex" in x:
            todo += [l for l in locs if not re.search(r"image|video|author|tag|category", l, re.I)][:6]
        else:
            urls += locs
        if urls and "<sitemapindex" not in x and sm.endswith(("/sitemap.xml", "/wp-sitemap.xml")):
            break
    return sorted(set(urls))

def scan(domain):
    url, home = get("https://" + domain)
    if not home:
        url, home = get("https://www." + domain)
    if not home:
        return {"domain": domain, "ok": False}
    pages = {"home": home}
    for p in ["/contact", "/contact-us", "/get-started", "/inquire", "/request-a-quote", "/free-consultation", "/get-a-quote"]:
        u, h = get(urllib.parse.urljoin(url, p))
        if h and u and not re.search(r"404|not found", h[:4000], re.I):
            pages[p] = h
            break
    allhtml = "\n".join(pages.values())
    links = internal_links(url, home)
    smap = sitemap_urls(url)
    paths = links | {urllib.parse.urlparse(u).path.rstrip("/").lower() for u in smap}
    svc = sorted(l for l in links if re.search(SERVICE_WORDS, l) and not re.search(SKIP_WORDS, l))
    concern = sorted(p for p in paths if re.search(CONCERN_WORDS, p) and not re.search(r"blog/|news/|tag/|category/", p))
    blogish = [p for p in paths if re.search(r"/blog/|/news/|/articles?/|/insights/|/resources/|/guides?/|/post/", p)]
    # depth: sample up to 6 service-like pages, else any internal pages
    sample = (svc or sorted(l for l in links if not re.search(SKIP_WORDS, l)))[:6]
    with ThreadPoolExecutor(6) as ex:
        got = list(ex.map(lambda p: get(urllib.parse.urljoin(url, p))[1], sample))
    d = [depth_of(h) for h in got if h]
    forms = [f for h in pages.values() for f in lead_forms(h)]
    text = text_of(home).lower()
    return {
        "domain": domain, "ok": True, "final": url, "contact_page_found": len(pages) > 1,
        "forms": forms,
        "form_open_box": any(f["open_box"] for f in forms) if forms else None,
        "form_service_picker": any(f["service_picker"] for f in forms) if forms else None,
        "form_tools": [k for k, v in FORM_TOOLS.items() if re.search(v, allhtml, re.I)],
        "self_serve": [k for k, v in SELF_SERVE.items() if re.search(v, allhtml, re.I)],
        "stack": [k for k, v in STACK.items() if re.search(v, allhtml, re.I)],
        "cta": [c for c in CTA if c in text],
        "prices_on_home": len(re.findall(r"\$\s?\d[\d,]{2,}", text)),
        "home_words": depth_of(home)[0],
        "sitemap_pages": len(smap), "blog_pages": len(blogish),
        "service_pages": len(svc), "service_sample": svc[:10],
        "concern_pages": len(concern), "concern_sample": concern[:10],
        "svc_pages_read": len(d),
        "svc_words_median": int(statistics.median([x[0] for x in d])) if d else 0,
        "svc_heads_median": int(statistics.median([x[1] for x in d])) if d else 0,
        "svc_long_paras_median": int(statistics.median([x[2] for x in d])) if d else 0,
        "svc_question_heads_total": sum(x[3] for x in d),
        "svc_decision_words_per_1k": statistics.median([x[4] for x in d]) if d else 0,
    }

def c8(r):
    """Suggested C8 (form does not ask what they want). None = form not readable, score by hand."""
    if r.get("form_open_box") is None:
        return None
    if not r["form_open_box"] and not r["form_service_picker"]:
        return 5
    if not r["form_open_box"]:
        return 2
    return 0

def c9(r):
    """Suggested C9 (depth: article-like pages about the service and its concerns). Thresholds are editable."""
    w, hd, pa, cp = r["svc_words_median"], r["svc_heads_median"], r["svc_long_paras_median"], r["concern_pages"]
    s = 0
    if w >= 1200 or (w >= 800 and hd >= 6): s = 3
    elif w >= 600: s = 2
    elif w >= 350: s = 1
    if pa >= 4: s += 1
    if cp >= 3: s += 1
    # Long text without decision content is usually SEO filler: cap it.
    if r["svc_question_heads_total"] < 2 and r["svc_decision_words_per_1k"] < 4:
        s = min(s, 2)
    return min(s, 5)

if __name__ == "__main__":
    jobs = [(t, d) for t, ds in SITES.items() for d in ds]
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda td: (td[0], scan(td[1])), jobs))
    rows = []
    for t, r in res:
        r["type"] = t
        if r["ok"]:
            r["c8_suggested"], r["c9_suggested"] = c8(r), c9(r)
        rows.append(r)
    json.dump(rows, open(sys.argv[1], "w", encoding="utf-8"), indent=1)
    for r in rows:
        if not r["ok"]:
            print(f"{r['type'][:24]:24} {r['domain']:30} FAILED"); continue
        fb = "?" if r["form_open_box"] is None else ("box" if r["form_open_box"] else "nobox") + ("+pick" if r["form_service_picker"] else "")
        print(f"{r['type'][:24]:24} {r['domain']:30} form={len(r['forms'])}:{fb:10} tools={','.join(r['form_tools']) or '-':14} "
              f"map={r['sitemap_pages']:4} blog={r['blog_pages']:4} svc={r['service_pages']:3} concern={r['concern_pages']:3} "
              f"words={r['svc_words_median']:5} h={r['svc_heads_median']:3} p40={r['svc_long_paras_median']:3} "
              f"q?={r['svc_question_heads_total']:3} dec/1k={r['svc_decision_words_per_1k']:4} "
              f"C8={r['c8_suggested']} C9={r['c9_suggested']} self={','.join(r['self_serve']) or '-'} stack={','.join(r['stack'])}")
