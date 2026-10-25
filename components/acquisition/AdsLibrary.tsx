"use client";
// components/acquisition/AdsLibrary.tsx
// Acquisition → Ads: every ad a click came from (one card per ad), newest first, the ones still missing a thumbnail or
// video on top. The team adds an internal tag ("2026 Core Demo Video"), the link to watch the video and a thumbnail
// (upload, or paste an image link; it is copied, because the ad networks' links expire). Hooked-lead messages in Slack
// use all three. Data: lib/actions/ads.action.ts, upload: app/api/ads/thumbnail.
import * as React from "react";
import Link from "next/link";
import { ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";
import { clearThumbnail, thumbnailFromLink, updateAd, type AdView } from "@/lib/actions/ads.action";
import { formatRelativeTime } from "@/lib/leadFormat";

function AdCard({ ad: initial }: { ad: AdView }) {
  const [ad, setAd] = React.useState(initial);
  const [tag, setTag] = React.useState(initial.tag ?? "");
  const [video, setVideo] = React.useState(initial.videoUrl ?? "");
  const [imgLink, setImgLink] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const save = async (patch: { tag?: string; videoUrl?: string }) => {
    if ((patch.tag ?? ad.tag ?? "") === (ad.tag ?? "") && (patch.videoUrl ?? ad.videoUrl ?? "") === (ad.videoUrl ?? "")) return;
    setBusy("save");
    const r = await updateAd(ad.platform, ad.adId, patch);
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "error", text: r.error });
    setAd((a) => ({ ...a, ...(patch.tag !== undefined ? { tag: patch.tag.trim() || null } : {}), ...(patch.videoUrl !== undefined ? { videoUrl: patch.videoUrl.trim() || null } : {}) }));
    setMsg({ tone: "ok", text: "Saved." });
  };
  const upload = async (file: File) => {
    setBusy("thumb");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("platform", ad.platform);
    fd.set("adId", ad.adId);
    const r = await fetch("/api/ads/thumbnail", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ ok: false, error: "The upload did not go through." }));
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "error", text: r.error });
    setAd((a) => ({ ...a, thumbnailUrl: r.thumbnailUrl }));
    setMsg({ tone: "ok", text: "Thumbnail saved." });
  };
  const fromLink = async () => {
    if (!imgLink.trim()) return;
    setBusy("thumb");
    const r = await thumbnailFromLink(ad.platform, ad.adId, imgLink);
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "error", text: r.error });
    setAd((a) => ({ ...a, thumbnailUrl: r.thumbnailUrl }));
    setImgLink("");
    setMsg({ tone: "ok", text: "Thumbnail saved." });
  };
  const remove = async () => {
    setBusy("thumb");
    const r = await clearThumbnail(ad.platform, ad.adId);
    setBusy(null);
    if (r.ok) setAd((a) => ({ ...a, thumbnailUrl: null }));
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
      <div className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 sm:w-48">
        {ad.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnailUrl} alt={ad.tag || ad.adName || "Ad thumbnail"} className="size-full object-cover" />
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ImagePlus className="size-5" /> Add a thumbnail
          </button>
        )}
        {busy === "thumb" && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
        {ad.thumbnailUrl && (
          <span className="absolute right-1 top-1 flex gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] hover:bg-background">
              Replace
            </button>
            <button type="button" onClick={remove} className="rounded bg-background/80 p-0.5 text-red-600 hover:bg-background" aria-label="Remove thumbnail">
              <Trash2 className="size-3" />
            </button>
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-foreground">{ad.tag || ad.adName || "Unnamed ad"}</span>
          <span className="text-xs text-muted-foreground">
            {ad.platform}
            {ad.campaign ? " · " + ad.campaign : ""} · {ad.clicks} click{ad.clicks === 1 ? "" : "s"} · last {formatRelativeTime(ad.lastSeen)}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {ad.adName && ad.tag ? <>Ad name: {ad.adName} · </> : null}id <span className="font-mono">{ad.adId}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={tag} maxLength={80} onChange={(e) => setTag(e.target.value)} onBlur={() => save({ tag })} placeholder="Your name for it, e.g. 2026 Core Demo Video" aria-label="Tag" className="h-8 rounded-md border bg-background px-2 text-xs" />
          <input value={video} maxLength={1000} onChange={(e) => setVideo(e.target.value)} onBlur={() => save({ videoUrl: video })} placeholder="Link to watch the video (https://...)" aria-label="Video link" className="h-8 rounded-md border bg-background px-2 text-xs" />
        </div>
        {!ad.thumbnailUrl && (
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <input value={imgLink} onChange={(e) => setImgLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fromLink()} placeholder="Or paste an image link for the thumbnail" aria-label="Thumbnail link" className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
            <button type="button" disabled={!imgLink.trim() || !!busy} onClick={fromLink} className="h-7 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40">
              Use
            </button>
          </div>
        )}
        {msg && <p className={"text-[11px] " + (msg.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{msg.text}</p>}
      </div>
    </li>
  );
}

export function AdsLibrary({ ads, ready }: { ads: AdView[]; ready: boolean }) {
  if (!ready) return <p className="text-sm text-muted-foreground">The Ads library is not set up on this database yet (migration 25).</p>;
  const ordered = [...ads].sort((a, b) => Number(!!(a.thumbnailUrl && a.videoUrl)) - Number(!!(b.thumbnailUrl && b.videoUrl)));
  return (
    <div className="mx-auto w-full max-w-4xl space-y-3">
      <p className="text-sm text-muted-foreground">
        Every ad a click came from. Add its video link and a thumbnail once: hooked leads in Slack then show the ad they came from, with the picture and a
        Watch the ad button. Ads missing either are on top.
      </p>
      {!ads.length ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No ads yet. They appear after the first click from an ad that carries its id.{" "}
          <Link href="/platform/acquisition?tab=setup" className="text-primary hover:underline">
            Set up ad tracking
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {ordered.map((a) => (
            <AdCard key={a.platform + "|" + a.adId} ad={a} />
          ))}
        </ul>
      )}
    </div>
  );
}
