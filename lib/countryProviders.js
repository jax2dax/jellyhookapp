// lib/countryProviders.js
//
// Country-by-IP is resolved through an ordered list of providers, tried in
// order until one succeeds. Every attempt is logged (provider name, ip,
// outcome) so it's visible exactly when and how often we're hitting a 3rd
// party — this used to be silent inside app/api/track/route.js.
//
// Add a fallback provider by pushing another entry here; nothing else needs
// to change. Each provider must be free/no-key to stay consistent with the
// existing ip-api.com choice.

async function ipApiCom(ip) {
  const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country`, {
    signal: AbortSignal.timeout(2000),
  });
  const data = await res.json();
  if (data.status !== "success" || !data.country) throw new Error("ip-api.com: no result");
  return data.country;
}

async function ipwhoIs(ip) {
  // ipwho.is — free, no key, no documented rate limit at the time this was
  // added. Used only as a fallback if ip-api.com fails or times out.
  const res = await fetch(`https://ipwho.is/${ip}`, {
    signal: AbortSignal.timeout(2000),
  });
  const data = await res.json();
  if (!data.success || !data.country) throw new Error("ipwho.is: no result");
  return data.country;
}

const PROVIDERS = [
  { name: "ip-api.com", resolve: ipApiCom },
  { name: "ipwho.is", resolve: ipwhoIs },
];

// Resolves a country for one IP, trying each provider in order. Logs every
// attempt so 3rd-party call volume is observable, not silent.
export async function resolveCountry(ip) {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return null;

  for (const provider of PROVIDERS) {
    const startedAt = Date.now();
    try {
      const country = await provider.resolve(ip);
      console.log(`[country-lookup] ${provider.name} ip=${ip} OK (${Date.now() - startedAt}ms) -> ${country}`);
      return country;
    } catch (err) {
      console.log(`[country-lookup] ${provider.name} ip=${ip} FAILED (${Date.now() - startedAt}ms): ${err.message}`);
    }
  }
  console.log(`[country-lookup] all providers failed ip=${ip}`);
  return null;
}
