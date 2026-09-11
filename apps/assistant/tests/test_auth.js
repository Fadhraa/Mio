import express from "express";
import { requireApiKey } from "../middlewares/authMiddleware.js";

process.env.MIO_API_KEY = "mio_sec_test_key_1234567890abcdef";

const app = express();
app.use(express.json());

app.get("/api/auth/verify", requireApiKey, (req, res) => {
  res.json({ ok: true, message: "Akses diverifikasi" });
});

app.get("/api/jadwal", requireApiKey, (req, res) => {
  res.json({ data: ["jadwal 1", "jadwal 2"] });
});

const server = app.listen(3999, async () => {
  console.log("Test server running on port 3999");
  const baseUrl = "http://localhost:3999";

  let allPassed = true;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      allPassed = false;
    }
  }

  // Test 1: Request tanpa header auth
  await test("Request tanpa header auth harus mengembalikan 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const body = await res.json();
    if (body.code !== "AUTH_KEY_MISSING") throw new Error(`Expected AUTH_KEY_MISSING, got ${body.code}`);
  });

  // Test 2: Request dengan token salah
  await test("Request dengan token salah harus mengembalikan 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: "Bearer wrong_secret_key" }
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const body = await res.json();
    if (body.code !== "AUTH_KEY_INVALID") throw new Error(`Expected AUTH_KEY_INVALID, got ${body.code}`);
  });

  // Test 3: Request dengan Bearer token yang benar
  await test("Request dengan Bearer token yang benar harus mengembalikan 200", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: "Bearer mio_sec_test_key_1234567890abcdef" }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = await res.json();
    if (!body.ok) throw new Error("Expected ok: true");
  });

  // Test 4: Request dengan x-api-key header yang benar
  await test("Request dengan x-api-key header yang benar harus mengembalikan 200", async () => {
    const res = await fetch(`${baseUrl}/api/jadwal`, {
      headers: { "x-api-key": "mio_sec_test_key_1234567890abcdef" }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = await res.json();
    if (!body.data) throw new Error("Expected data array");
  });

  // Test 5: Request dengan query parameter key yang benar
  await test("Request dengan query parameter key yang benar harus mengembalikan 200", async () => {
    const res = await fetch(`${baseUrl}/api/jadwal?key=mio_sec_test_key_1234567890abcdef`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  server.close(() => {
    if (allPassed) {
      console.log("\n>>> SEMUA UJI KEAMANAN API KEY BERHASIL! <<<");
      process.exit(0);
    } else {
      console.error("\n>>> ADA UJI KEAMANAN YANG GAGAL! <<<");
      process.exit(1);
    }
  });
});
