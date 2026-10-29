// scripts/seo/indexnow.mjs
// Tells Bing, Yandex, Seznam and the other IndexNow search engines that jellyhook.com's pages changed, so they crawl
// them again soon. Reads the live sitemap and sends every address in it. Run AFTER the deploy is live (the key file
// public/fd33fa92792a27585a82dcf42fb254bf.txt must answer on jellyhook.com first): npm run seo:indexnow
// Google does not use IndexNow: submit the sitemap in Google Search Console instead (mds/build/seo.md).
const HOST = "jellyhook.com";
const KEY = "fd33fa92792a27585a82dcf42fb254bf";
const KEY_URL = `https://${HOST}/${KEY}.txt`;

const keyRes = await fetch(KEY_URL);
if (!keyRes.ok || (await keyRes.text()).trim() !== KEY) {
  console.error(`The key file is not live yet (${KEY_URL}). Deploy first, then run this again.`);
  process.exit(1);
}

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!urls.length) {
  console.error("No addresses found in the sitemap.");
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_URL, urlList: urls }),
});
// 200 and 202 both mean accepted
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urls.length} addresses`);
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
