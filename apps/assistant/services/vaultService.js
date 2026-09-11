import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import { logWA } from "./waLogger.js";
import { DATABASE_DIR, MEMORY_DIR } from "../paths.js";

const DB_DIR = DATABASE_DIR;
const DB_FILE = path.join(DB_DIR, "vault.db");
const OLD_DB_FILE = path.join(MEMORY_DIR, "vault.db");
const JSON_FILE = path.join(MEMORY_DIR, "vault.json");


if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Relokasi otomatis jika vault.db sebelumnya ada di memory/
if (fs.existsSync(OLD_DB_FILE) && !fs.existsSync(DB_FILE)) {
  try {
    fs.renameSync(OLD_DB_FILE, DB_FILE);
    if (fs.existsSync(`${OLD_DB_FILE}-wal`))
      fs.renameSync(`${OLD_DB_FILE}-wal`, `${DB_FILE}-wal`);
    if (fs.existsSync(`${OLD_DB_FILE}-shm`))
      fs.renameSync(`${OLD_DB_FILE}-shm`, `${DB_FILE}-shm`);
    logWA.info(
      "✅ [RELOKASI DATABASE]: File vault.db berhasil dipindahkan dari folder memory/ ke database/",
    );
  } catch (e) {
    logWA.error("[ERROR MOVE DB FILE]:", e);
  }
}

let dbInstance = null;

async function dapatkanDb() {
  if (dbInstance) return dbInstance;
  try {
    dbInstance = await open({
      filename: DB_FILE,
      driver: sqlite3.Database,
    });

    await dbInstance.exec("PRAGMA journal_mode = WAL;");
    await dbInstance.exec("PRAGMA synchronous = NORMAL;");

    // Inisialisasi Skema Tabel Vault
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS vault (
        id TEXT PRIMARY KEY,
        kategori TEXT NOT NULL,
        judul TEXT NOT NULL,
        tipe_content TEXT NOT NULL,
        payload TEXT NOT NULL,
        ringkasan TEXT,
        canonical_hash TEXT NOT NULL UNIQUE,
        privacy_tier TEXT DEFAULT 'cloud_enriched',
        tags TEXT,
        sumber TEXT DEFAULT 'whatsapp_group',
        file_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vault_hash ON vault(canonical_hash);
      CREATE INDEX IF NOT EXISTS idx_vault_kategori ON vault(kategori);
      CREATE INDEX IF NOT EXISTS idx_vault_created ON vault(created_at DESC);
    `);

    await migrasiDariJson(dbInstance);
    return dbInstance;
  } catch (err) {
    logWA.error("[ERROR INITIALIZE SQLITE DATABASE]:", err);
    return null;
  }
}

/**
 * Migrasi otomatis dari vault.json jika vault.db belum memiliki data
 */
async function migrasiDariJson(db) {
  try {
    if (!fs.existsSync(JSON_FILE)) return;

    const countResult = await db.get("SELECT COUNT(*) as count FROM vault");
    if (countResult && countResult.count > 0) return;

    const raw = fs.readFileSync(JSON_FILE, "utf-8");
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || items.length === 0) return;

    await db.exec("BEGIN TRANSACTION;");
    for (const item of items) {
      let cleanPayload = item.payload || "";
      if (item.file_name && (cleanPayload.includes(":\\") || !cleanPayload)) {
        cleanPayload = `storage/media/${item.file_name}`;
      }

      await db.run(
        `INSERT OR IGNORE INTO vault (
          id, kategori, judul, tipe_content, payload, ringkasan,
          canonical_hash, privacy_tier, tags, sumber, file_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.kategori || "umum",
        item.judul || "Tanpa Judul",
        item.tipe_content || "teks",
        cleanPayload,
        item.ringkasan || "",
        item.canonical_hash,
        item.privacy_tier || "cloud_enriched",
        JSON.stringify(item.tags || []),
        item.sumber || "whatsapp_group",
        item.file_name || null,
        item.created_at || new Date().toISOString(),
        item.updated_at || new Date().toISOString(),
      );
    }
    await db.exec("COMMIT;");
    logWA.info(
      `✅ [MIGRASI AUTOMATIC SUCCESS]: ${items.length} data dari vault.json berhasil dipindahkan ke SQLite vault.db`,
    );

    // Cadangkan file JSON lama
    fs.renameSync(JSON_FILE, `${JSON_FILE}.bak`);
  } catch (err) {
    try {
      await db.exec("ROLLBACK;");
    } catch (e) {}
    logWA.error("[ERROR MIGRASI VAULT JSON TO SQLITE]:", err);
  }
}

/**
 * Format baris SQLite ke objek Javascript Vault yang konsisten
 */
function formatBarisVault(baris) {
  if (!baris) return null;
  let parsedTags = [];
  try {
    parsedTags = baris.tags ? JSON.parse(baris.tags) : [];
  } catch (e) {
    parsedTags = [];
  }

  return {
    ...baris,
    tags: parsedTags,
  };
}

export async function ambilSemuaVault(limit = 100, offset = 0) {
  try {
    const db = await dapatkanDb();
    if (!db) return [];
    const rows = await db.all(
      "SELECT * FROM vault ORDER BY created_at DESC LIMIT ? OFFSET ?",
      limit,
      offset,
    );
    return rows.map(formatBarisVault);
  } catch (error) {
    logWA.error("[ERROR AMBIL SEMUA VAULT]:", error);
    return [];
  }
}

export async function cariVaultByHash(canonicalHash) {
  try {
    const db = await dapatkanDb();
    if (!db) return null;
    const row = await db.get(
      "SELECT * FROM vault WHERE canonical_hash = ?",
      canonicalHash,
    );
    return formatBarisVault(row);
  } catch (error) {
    logWA.error("[ERROR CARI VAULT BY HASH]:", error);
    return null;
  }
}

export async function simpanVault(item) {
  try {
    const db = await dapatkanDb();
    if (!db) return false;

    let cleanPayload = item.payload || "";
    if (item.file_name && (cleanPayload.includes(":\\") || !cleanPayload)) {
      cleanPayload = `storage/media/${item.file_name}`;
    }

    await db.run(
      `INSERT INTO vault (
        id, kategori, judul, tipe_content, payload, ringkasan,
        canonical_hash, privacy_tier, tags, sumber, file_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.kategori || "umum",
      item.judul || "Tanpa Judul",
      item.tipe_content || "teks",
      cleanPayload,
      item.ringkasan || "",
      item.canonical_hash,
      item.privacy_tier || "cloud_enriched",
      JSON.stringify(item.tags || []),
      item.sumber || "whatsapp_group",
      item.file_name || null,
      item.created_at || new Date().toISOString(),
      item.updated_at || new Date().toISOString(),
    );
    return true;
  } catch (error) {
    logWA.error("[ERROR SIMPAN VAULT SQLITE]:", error);
    return false;
  }
}

export async function perbaruiTimestampVault(canonicalHash) {
  try {
    const db = await dapatkanDb();
    if (!db) return null;
    const nowIso = new Date().toISOString();
    const result = await db.run(
      "UPDATE vault SET updated_at = ? WHERE canonical_hash = ?",
      nowIso,
      canonicalHash,
    );

    if (result.changes > 0) {
      return await cariVaultByHash(canonicalHash);
    }
  } catch (error) {
    logWA.error("[ERROR UPDATE VAULT TIMESTAMP]:", error);
  }
  return null;
}

export async function hapusVaultItem(id) {
  try {
    const db = await dapatkanDb();
    if (!db) return false;
    const result = await db.run("DELETE FROM vault WHERE id = ?", id);
    return result.changes > 0;
  } catch (error) {
    logWA.error("[ERROR HAPUS VAULT ITEM]:", error);
    return false;
  }
}
