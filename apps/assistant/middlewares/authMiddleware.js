import crypto from "crypto";

/**
 * Menghasilkan API Key acak dengan entropi tinggi dan awalan standar.
 * @param {string} prefix 
 * @returns {string}
 */
export function generateApiKey(prefix = "mio_sec_") {
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`;
}

/**
 * Middleware untuk memvalidasi API Key pada setiap request HTTP.
 * Mendukung autentikasi via:
 * 1. Header 'Authorization: Bearer <KEY>'
 * 2. Header 'x-api-key: <KEY>'
 * 3. Query Parameter '?key=<KEY>' atau '?api_key=<KEY>' (untuk EventSource/SSE)
 */
export function requireApiKey(req, res, next) {
  const configuredKey = process.env.MIO_API_KEY;

  if (!configuredKey) {
    console.error("[CRITICAL SECURITY]: MIO_API_KEY belum dikonfigurasi di environment (.env). Seluruh request API ditolak demi keamanan data.");
    return res.status(500).json({
      error: "Konfigurasi Keamanan Server Belum Lengkap",
      message: "Server belum memiliki MIO_API_KEY. Harap atur MIO_API_KEY di file .env",
      code: "SECURITY_UNCONFIGURED"
    });
  }

  // 1. Ekstraksi token dari berbagai channel yang diizinkan
  let providedToken = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.substring(7).trim();
  } else if (req.headers["x-api-key"]) {
    providedToken = String(req.headers["x-api-key"]).trim();
  } else if (req.query.key) {
    providedToken = String(req.query.key).trim();
  } else if (req.query.api_key) {
    providedToken = String(req.query.api_key).trim();
  }

  if (!providedToken) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Akses ditolak: API Key wajib disertakan pada header 'Authorization: Bearer <KEY>' atau 'x-api-key'.",
      code: "AUTH_KEY_MISSING"
    });
  }

  // 2. Constant-time comparison menggunakan SHA-256 digest
  // Mencegah Timing Attacks yang dapat membocorkan karakter kunci satu per satu
  const hashProvided = crypto.createHash("sha256").update(providedToken).digest();
  const hashExpected = crypto.createHash("sha256").update(configuredKey).digest();

  const isMatch = crypto.timingSafeEqual(hashProvided, hashExpected);

  if (!isMatch) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Akses ditolak: API Key tidak valid.",
      code: "AUTH_KEY_INVALID"
    });
  }

  // Lolos autentikasi
  next();
}
