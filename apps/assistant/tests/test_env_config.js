import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../..");

console.log("\n=======================================================");
console.log("       UJI KONFIGURASI SINGLE ROOT .ENV MONOREPO       ");
console.log("=======================================================\n");

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`✓ [PASS] ${description}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${description}`);
    failed++;
  }
}

// 1. Cek keberadaan root .env
const rootEnvPath = path.join(ROOT_DIR, ".env");
assert("File root .env harus ada di root monorepo", fs.existsSync(rootEnvPath));

// 2. Cek apakah ada file .env bersarang yang tertinggal di apps/*
const appsDir = path.join(ROOT_DIR, "apps");
const nestedEnvs = [];
function cariNestedEnv(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === "node_modules" || item.name === ".git") continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      cariNestedEnv(fullPath);
    } else if (item.name === ".env") {
      nestedEnvs.push(fullPath);
    }
  }
}
cariNestedEnv(appsDir);
assert("Tidak boleh ada file .env bersarang di dalam apps/*", nestedEnvs.length === 0);
if (nestedEnvs.length > 0) {
  console.log("   Ditemukan file .env tertinggal:", nestedEnvs);
}

// 3. Baca dan verifikasi variabel kunci di root .env
const envConfig = dotenv.parse(fs.readFileSync(rootEnvPath, "utf-8"));
assert("Root .env harus mendefinisikan MIO_API_KEY", Boolean(envConfig.MIO_API_KEY));
assert("Root .env harus mendefinisikan PORT", Boolean(envConfig.PORT));
assert("Root .env harus mendefinisikan VITE_MIO_API_KEY untuk Frontend", Boolean(envConfig.VITE_MIO_API_KEY));
assert("MIO_API_KEY dan VITE_MIO_API_KEY harus bernilai sama dan sinkron", envConfig.MIO_API_KEY === envConfig.VITE_MIO_API_KEY);
assert("Root .env harus mendefinisikan USER_NAME", Boolean(envConfig.USER_NAME));

// 4. Verifikasi vite.config.js telah menyertakan envDir
const viteConfigPath = path.join(appsDir, "web", "vite.config.js");
const viteContent = fs.readFileSync(viteConfigPath, "utf-8");
assert("vite.config.js harus mengonfigurasi envDir ke root monorepo", viteContent.includes("envDir"));

console.log(`\nHasil: ${passed} lolos, ${failed} gagal.`);
if (failed === 0) {
  console.log(">>> SEMUA PENGUJIAN ROOT .ENV TERPADU BERHASIL! <<<\n");
  process.exit(0);
} else {
  console.error(">>> TERDAPAT PENGUJIAN YANG GAGAL! <<<\n");
  process.exit(1);
}
