// app/twitter-image.tsx: the same share picture for X (Twitter) cards (./opengraph-image.tsx draws it).
import OpengraphImage from "./opengraph-image";

export const alt = "Jellyhook: stop treating every lead like a stranger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return OpengraphImage();
}
