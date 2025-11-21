// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"]; // tumhara private key
const TARGET_API = "https://flipcartstore.serv00.net/PHONE/1.php"; // WORKING API
const TARGET_API_KEY = "cyberGen123"; // upstream API key
const CACHE_TIME = 3600 * 1000; // 1 hour (ms)
// =================================================

const cache = new Map();

// Helper: recursively clean @oxmzoo from JSON
function cleanOxmzoo(value) {
  if (typeof value === "string") {
    return value.replace(/@oxmzoo/gi, "").trim();
  }
  if (Array.isArray(value)) {
    return value.map(cleanOxmzoo);
  }
  if (value && typeof value === "object") {
    const cleaned = {};
    for (const key of Object.keys(value)) {
      if (key === "@oxmzoo") continue;
      cleaned[key] = cleanOxmzoo(value[key]);
    }
    return cleaned;
  }
  return value;
}

module.exports = async (req, res) => {
  // Sirf GET allow
  if (req.method !== "GET") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(405).json({ error: "method not allowed" });
  }

  const { mobile: rawMobile, key: rawKey } = req.query || {};

  // Param check
  if (!rawMobile || !rawKey) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(400).json({ error: "missing parameters: mobile or key" });
  }

  // Sirf digits rakho
  const mobile = String(rawMobile).replace(/\D/g, "");
  const key = String(rawKey).trim();

  // API key check
  if (!YOUR_API_KEYS.includes(key)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(403).json({ error: "invalid key" });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(mobile);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(cached.response);
  }

  // Upstream URL build - WORKING API
  const url = `${TARGET_API}?api_key=${TARGET_API_KEY}&mobile=${encodeURIComponent(mobile)}`;

  try {
    const upstream = await fetch(url);
    const raw = await upstream.text();

    if (!upstream.ok || !raw) {  
      res.setHeader("Content-Type", "application/json; charset=utf-8");  
      return res.status(502).json({  
        error: "upstream API failed",  
        details: `HTTP ${upstream.status}`,  
      });  
    }  

    let responseBody;  

    try {  
      // JSON parse try  
      let data = JSON.parse(raw);  

      // Saare data se @oxmzoo clean karo  
      data = cleanOxmzoo(data);  

      // Apni clean branding  
      data.developer = "splexxo";  
      data.powered_by = "splexxo Info API";  

      responseBody = JSON.stringify(data);  
    } catch {  
      // Agar JSON nahi hai to raw text me se bhi @oxmzoo hata do  
      const cleanedText = raw.replace(/@oxmzoo/gi, "").trim();  
      responseBody = cleanedText;  
    }  

    // Cache save  
    cache.set(mobile, {  
      timestamp: Date.now(),  
      response: responseBody,  
    });  

    res.setHeader("X-Proxy-Cache", "MISS");  
    res.setHeader("Content-Type", "application/json; charset=utf-8");  
    return res.status(200).send(responseBody);

  } catch (err) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(502).json({
      error: "upstream request error",
      details: err.message || "unknown error",
    });
  }
};
