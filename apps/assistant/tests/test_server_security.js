import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requireApiKey } from "../middlewares/authMiddleware.js";

// Setup server uji dengan konfigurasi identik server.js
const app = express();
const TEST_PORT = 3998;
const TEST_API_KEY = "mio_sec_integration_test_abc123456789";
process.env.MIO_API_KEY = TEST_API_KEY;
process.env.CORS_ORIGIN = "http://localhost:5173,http://localhost:3000";

// 1. Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS
const defaultOrigins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000";
const allowedOrigins = (process.env.CORS_ORIGIN || defaultOrigins)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS Policy: Origin ${origin} tidak diizinkan.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

app.use(express.json());

// Endpoints
app.get("/api/auth/verify", requireApiKey, (req, res) => {
  res.json({ ok: true, message: "Akses diverifikasi." });
});

app.use("/api", requireApiKey);

app.get("/api/jadwal", (req, res) => {
  res.json([{ id: 1, kegiatan: "Kuliah Rekayasa Perangkat Lunak" }]);
});

app.post("/api/chat", (req, res) => {
  res.json({ reply: "Halo dari Mio Core AI" });
});

const server = app.listen(TEST_PORT, async () => {
  console.log(`[TEST RUNNER] Server pengujian keamanan berjalan pada port ${TEST_PORT}`);
  const baseUrl = `http://localhost:${TEST_PORT}`;
  let passedCount = 0;
  let failedCount = 0;

  async function assertTest(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      failedCount++;
    }
  }

  console.log("\n--- Menjalankan Uji Keamanan API Key & Server Hardening ---");

  // Uji 1: Helmet Header Security
  await assertTest("Helmet: X-Powered-By harus dinonaktifkan", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`);
    if (res.headers.get("x-powered-by")) {
      throw new Error("Header x-powered-by masih bocor!");
    }
  });

  // Uji 2: CORS Preflight
  await assertTest("CORS: Preflight OPTIONS request diizinkan untuk origin terdaftar", async () => {
    const res = await fetch(`${baseUrl}/api/jadwal`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization,Content-Type",
      },
    });
    if (res.status !== 204 && res.status !== 200) {
      throw new Error(`Expected status 204 or 200, got ${res.status}`);
    }
    const allowOrigin = res.headers.get("access-control-allow-origin");
    if (allowOrigin !== "http://localhost:5173") {
      throw new Error(`CORS header mismatch: ${allowOrigin}`);
    }
  });

  // Uji 3: Penolakan Akses Tanpa API Key
  await assertTest("Auth: Endpoint /api/jadwal menolak request tanpa token (401)", async () => {
    const res = await fetch(`${baseUrl}/api/jadwal`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const body = await res.json();
    if (body.code !== "AUTH_KEY_MISSING") throw new Error(`Expected code AUTH_KEY_MISSING, got ${body.code}`);
  });

  // Uji 4: Penolakan Akses Token Salah
  await assertTest("Auth: Endpoint /api/jadwal menolak request token palsu (401)", async () => {
    const res = await fetch(`${baseUrl}/api/jadwal`, {
      headers: { Authorization: "Bearer token_palsu_123" },
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const body = await res.json();
    if (body.code !== "AUTH_KEY_INVALID") throw new Error(`Expected code AUTH_KEY_INVALID, got ${body.code}`);
  });

  // Uji 5: Verifikasi Berhasil dengan Bearer Token
  await assertTest("Auth: Endpoint /api/auth/verify sukses dengan Bearer Token yang sah (200)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = await res.json();
    if (!body.ok) throw new Error("Response body ok should be true");
  });

  // Uji 6: Akses Endpoint Protected dengan x-api-key
  await assertTest("Auth: Endpoint /api/chat sukses dengan header x-api-key (200)", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TEST_API_KEY,
      },
      body: JSON.stringify({ message: "Test halo" }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = await res.json();
    if (!body.reply) throw new Error("Response reply expected");
  });

  server.close(() => {
    console.log(`\nHasil: ${passedCount} lolos, ${failedCount} gagal.`);
    if (failedCount === 0) {
      console.log(">>> SEMUA INTEGRATION TEST KEAMANAN SERVER BERHASIL DILALUI! <<<\n");
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
});
