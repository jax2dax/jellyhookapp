// lib/countryProviders.js
//
// Country-by-IP is resolved through an ordered list of providers, tried in
// order until one succeeds. It is only used when the hosting platform gave no
// country header (see lib/tracking/ip.js). Every attempt is logged (provider
// name, outcome) so it's visible how often we're hitting a 3rd party. The IP
// itself is never written to the logs: it is personal data.
//
// Every provider MUST be reached over HTTPS, because the visitor's IP travels
// in the request. ip-api.com was removed for this reason: its free tier is
// HTTP-only. The privacy page (app/privacy/page.tsx) names the providers
// listed here, so update it when this list changes.

async function ipwhoIs(ip) {
  // ipwho.is — free, no key, over HTTPS.
  const res = await fetch(`https://ipwho.is/${ip}`, {
    signal: AbortSignal.timeout(2000),
  });
  const data = await res.json();
  if (!data.success || !data.country) throw new Error("ipwho.is: no result");
  return data.country;
}

const PROVIDERS = [{ name: "ipwho.is", resolve: ipwhoIs }];

// Resolves a country for one IP, trying each provider in order. Logs every
// attempt (without the IP) so 3rd-party call volume is observable, not silent.
export async function resolveCountry(ip) {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return null;

  for (const provider of PROVIDERS) {
    const startedAt = Date.now();
    try {
      const country = await provider.resolve(ip);
      console.log(`[country-lookup] ${provider.name} OK (${Date.now() - startedAt}ms) -> ${country}`);
      return country;
    } catch (err) {
      console.log(`[country-lookup] ${provider.name} FAILED (${Date.now() - startedAt}ms): ${err.message}`);
    }
  }
  console.log("[country-lookup] all providers failed");
  return null;
}
