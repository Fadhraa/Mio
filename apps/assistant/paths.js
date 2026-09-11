import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

/**
 * Root direktori absolut untuk aplikasi assistant (D:\coding\Mio\apps\assistant)
 * Menghindari ketergantungan pada process.cwd() yang berubah saat dijalankan dari root monorepo.
 */
export const ASSISTANT_ROOT = path.dirname(__filename);

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
