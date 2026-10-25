"use client";
// DEMO with FAKE data: Acquisition → Ads (the Ads library) and Set up ad tracking. Saving calls the real server and
// fails here (no signed-in site).
import { AdsLibrary } from "@/components/acquisition/AdsLibrary";
import { TrackingSetup } from "@/components/acquisition/TrackingSetup";

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const ads = [
  { platform: "Meta", adId: "120214567890123", adName: "Core Demo v3 - 30s", campaign: "Spring sale", tag: "2026 Core Demo Video", videoUrl: "https://www.facebook.com/ads/library/?id=1", thumbnailUrl: "/jellyhook-nobg.png", clicks: 41, firstSeen: ago(200), lastSeen: ago(2) },
  { platform: "Google", adId: "678901234567", adName: null, campaign: "Brand search", tag: null, videoUrl: null, thumbnailUrl: null, clicks: 12, firstSeen: ago(100), lastSeen: ago(5) },
  { platform: "TikTok", adId: "1789000000", adName: "UGC founder story", campaign: "Awareness", tag: null, videoUrl: null, thumbnailUrl: null, clicks: 7, firstSeen: ago(50), lastSeen: ago(30) },
];

export default function AdsDemo() {
  return (
    <div className="space-y-8 p-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-orange-500">Demo, fake data</div>
      <AdsLibrary ads={ads} ready />
      <TrackingSetup />
    </div>
  );
}
