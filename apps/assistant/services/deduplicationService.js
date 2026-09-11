import crypto from "crypto";
import {
  cariVaultByHash,
  simpanVault,
  perbaruiTimestampVault,
} from "./vaultService.js";
import { logWA } from "./waLogger.js";

export function dapatkanCanonicalUrl(url) {
  try {
    const parsedUrl = new URL(url);
    // Hapus tracking query params yang tidak relevan
    parsedUrl.search = "";
    return parsedUrl.toString().toLowerCase();
  } catch (e) {
    return url.toLowerCase().trim();
  }
}

export function buatCanonicalHash(inputTeks) {
  return crypto.createHash("sha256").update(inputTeks).digest("hex");
}

export async function prosesSimpanKeVault(dataEkstrak) {
  // Jika sudah terdeteksi duplikat biner pada tahap awal ekstraksi gambar
  if (dataEkstrak.isPreCheckedDuplicate) {
    logWA.info(
      `⚡ [INSTANT BINARY DUP]: Foto fisik sudah ada di Vault (ID: ${dataEkstrak.existingItem.id})`,
    );
    await perbaruiTimestampVault(dataEkstrak.canonical_hash);
    return {
      isDuplicate: true,
      item: dataEkstrak.existingItem,
    };
  }

  // 1. Tentukan string acuan hash (Hash Biner Gambar, URL, atau Teks Ringkasan)
  const hashCanonical =
    dataEkstrak.canonical_hash ||
    buatCanonicalHash(
      dataEkstrak.url
        ? dapatkanCanonicalUrl(dataEkstrak.url)
        : (dataEkstrak.ringkasan || dataEkstrak.judul || "").toLowerCase().trim(),
    );

  // 2. Cek apakah Hash sudah pernah ada di Database SQLite Vault (Query Terindeks O(1))
  const itemLama = await cariVaultByHash(hashCanonical);
  if (itemLama) {
    logWA.warn(
      `⚠️ [DUPLIKAT TERDETEKSI]: Data sudah ada di Vault (ID: ${itemLama.id})`,
    );
    await perbaruiTimestampVault(hashCanonical);
    return {
      isDuplicate: true,
      item: itemLama,
    };
  }

  // 3. Jika Data Baru, buat entitas Vault terstruktur
  const relativePayload = dataEkstrak.file_name
    ? `storage/media/${dataEkstrak.file_name}`
    : dataEkstrak.url || "";

  const itemBaru = {
    id: `vlt_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`,
    kategori: dataEkstrak.kategori || "umum",
    judul: dataEkstrak.judul || "Catatan Tanpa Judul",
    tipe_content: dataEkstrak.tipe || (dataEkstrak.url ? "link" : "teks"),
    payload: relativePayload,
    ringkasan: dataEkstrak.ringkasan || dataEkstrak.deskripsi || "",
    canonical_hash: hashCanonical,
    privacy_tier: "cloud_enriched",
    tags: dataEkstrak.tags || [dataEkstrak.kategori || "umum"],
    sumber: "whatsapp_group",
    file_name: dataEkstrak.file_name || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await simpanVault(itemBaru);
  logWA.info(
    `✅ [BARU DISIMPAN KE VAULT SQLITE]: ${itemBaru.judul} [${itemBaru.kategori}]`,
  );
  return {
    isDuplicate: false,
    item: itemBaru,
  };
}



