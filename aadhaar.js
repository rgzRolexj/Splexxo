// api/aadhaar.js  (ya api/fetch.js – naam aap kuchh bhi rakh sakte ho)

// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"]; // tumhara private key
const TARGET_API    = "https://addartofamily.vercel.app/fetch"; // original API
const CACHE_TIME    = 3600 * 1000; // 1 hour in ms
// ==================================================

// In-memory cache (sirf warm function ke dauraan rahega)
const cache = new Map();

/**
 * Vercel Serverless Function handler
 * URL example:
 * https://your-vercel-domain.vercel.app/api/aadhaar?aadhaar=658014451208&key=SPLEXXO
 */
module.exports = async (req, res) => {
  // Sirf GET allow karo
  if (req.method !== "GET") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(405).json({ error: "method not allowed" });
  }

  // Query params lo
  const { aadhaar: rawAadhaar, key: rawKey } = req.query || {};

  // Validate params
  if (!rawAadhaar || !rawKey) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(400).json({ error: "missing parameters" });
  }

  // Sanitize aadhaar (sirf digits)
  const aadhaar = String(rawAadhaar).replace(/\D/g, "");
  const key = String(rawKey).trim();

  // Key validation
  if (!YOUR_API_KEYS.includes(key)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(403).json({ error: "invalid key" });
  }

  // Check cache
  let isCached = false;
  const now = Date.now();
  const cached = cache.get(aadhaar);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    isCached = true;
  }

  let responseBody;

  if (isCached) {
    responseBody = cached.response;
  } else {
    // Build target URL
    const url = `${TARGET_API}?aadhaar=${encodeURIComponent(aadhaar)}&key=fxt`;

    // Upstream request with timeout (approx 20 sec)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let upstreamRes;
    let raw;
    try {
      upstreamRes = await fetch(url, { signal: controller.signal });
      raw = await upstreamRes.text();
    } catch (err) {
      clearTimeout(timeout);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(502).json({
        error: "upstream API failed",
        details: err.message || "fetch error",
      });
    }

    clearTimeout(timeout);

    if (!upstreamRes.ok || !raw) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(502).json({
        error: "upstream API failed",
        details: `HTTP ${upstreamRes.status}`,
      });
    }

    // Modify response fields (optional)
    try {
      const data = JSON.parse(raw);
      data.developer = "splexxo";
      data.powered_by = "splexxo Custom API";
      responseBody = JSON.stringify(data);
    } catch (e) {
      // Agar JSON nahi hai to jo aaya woh hi pass kar do
      responseBody = raw;
    }

    // Cache set
    cache.set(aadhaar, {
      timestamp: now,
      response: responseBody,
    });
  }

  // Logging (Vercel logs)
  const ipRaw =
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    "unknown";

  const ip = Array.isArray(ipRaw) ? ipRaw[0] : ipRaw;
  const ipMask = typeof ip === "string"
    ? ip.replace(/(\d+\.\d+)\.\d+\.\d+/, "$1.x.x")
    : "unknown";

  const time = new Date().toISOString().replace("T", " ").split(".")[0];
  console.log(
    `${time} | ${ipMask} | aadhaar=${aadhaar} | cached=${isCached ? "yes" : "no"}`
  );

  // Headers
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Proxy-Cache", isCached ? "HIT" : "MISS");

  // Output
  return res.status(200).send(responseBody);
};
