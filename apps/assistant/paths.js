import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);

/**
 * Root direktori absolut untuk aplikasi assistant (D:\coding\Mio\apps\assistant)
 * Menghindari ketergantungan pada process.cwd() yang berubah saat dijalankan dari root monorepo.
 */
export const ASSISTANT_ROOT = path.dirname(__filename);
export const ROOT_DIR = path.resolve(ASSISTANT_ROOT, "../..");

// Pemuatan .env secara deterministik dari root monorepo atau fallback lokal
const rootEnvPath = path.join(ROOT_DIR, ".env");
const localEnvPath = path.join(ASSISTANT_ROOT, ".env");
const targetEnv = fs.existsSync(rootEnvPath) ? rootEnvPath : localEnvPath;
if (fs.existsSync(targetEnv)) {
  dotenv.config({ path: targetEnv });
}

// Konfigurasi Nama Pengguna Terabstraksi
export const USER_NAME = process.env.USER_NAME || "User";


// Direktori Utama
export const MEMORY_DIR = path.join(ASSISTANT_ROOT, "memory");
export const DATABASE_DIR = path.join(ASSISTANT_ROOT, "database");
export const STORAGE_DIR = path.join(ASSISTANT_ROOT, "storage");
export const LOGS_DIR = path.join(ASSISTANT_ROOT, "logs");
export const WA_SESSION_DIR = path.join(ASSISTANT_ROOT, "Wa_session");
export const WORKSPACE_DIR = path.join(ASSISTANT_ROOT, "mio_workspace");

// File Memori Spesifik
export const INFORMATION_PATH = path.join(MEMORY_DIR, "information.json");
export const JADWAL_PATH = path.join(MEMORY_DIR, "jadwal.json");
export const HABIT_PATH = path.join(MEMORY_DIR, "habit.json");
export const TUGAS_PATH = path.join(MEMORY_DIR, "tugas.json");
export const DOCS_PATH = path.join(MEMORY_DIR, "google_docs.json");
export const WA_SYNC_PATH = path.join(MEMORY_DIR, "wa_sync.json");
