import crypto from "crypto";
import { ekstrakUrlDanKonteks } from "./linkEkstraktor.js";

const KATA_KUNCI_PENGUMUMAN = [
  "pengumuman",
  "pemberitahuan",
  "sertifikat",
  "kelulusan",
  "peserta",
  "informasi",
  "edaran",
  "undangan",
  "hasil seleksi",
  "catatan:",
  "tips:",
  "peringatan:",
  "selamat atas",
  "narahubung",
  "contact person",
  "chat only",
  "halo, teman-teman",
  "halo teman-teman",
  "assalamualaikum",
];

/**
 * Mendeteksi apakah pesan WhatsApp adalah satu kesatuan dokumen pengumuman utuh
 */
export function deteksiApakahPengumuman(teks) {
  if (!teks || typeof teks !== "string") return false;

  const teksTrim = teks.trim();
  // 1. Kriteria Panjang: Pengumuman umumnya panjang (> 200 karakter)
  if (teksTrim.length < 200) return false;

  // 2. Kriteria Struktur: Memiliki beberapa baris/paragraf
  const barisList = teksTrim.split("\n").map((b) => b.trim()).filter(Boolean);
  if (barisList.length < 4) return false;

  // 3. Kriteria Kata Kunci Penanda
  const lower = teksTrim.toLowerCase();
  let scoreKeywords = 0;
  for (const kunci of KATA_KUNCI_PENGUMUMAN) {
    if (lower.includes(kunci)) {
      scoreKeywords++;
    }
  }

  // Jika memiliki minimal 2 indikator kata kunci dan panjang teks memadai
  return scoreKeywords >= 2;
}

/**
 * Mengekstrak dokumen pengumuman utuh beserta judul, lampiran tautan, dan ringkasan
 */
export function ekstrakDokumenPengumuman(teks) {
  const barisList = teks
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);

  // 1. Ekstraksi Judul
  let calonJudul = barisList[0] || "Pengumuman Kegiatan";
  // Bersihkan karakter penutup aneh seperti ']', '*', '#', dll.
  calonJudul = calonJudul.replace(/^[\[>:\-\s*#]+|[\]:\-\s*#]+$/g, "").trim();

  // Jika baris pertama hanya sapaan pendek, ambil baris kedua
  if (calonJudul.toLowerCase().startsWith("halo") && barisList.length > 1) {
    const barisKedua = barisList[1].replace(/^[\[>:\-\s*#]+|[\]:\-\s*#]+$/g, "").trim();
    if (barisKedua.length > 5 && barisKedua.length < 100) {
      calonJudul = barisKedua;
    }
  }

  if (calonJudul.length > 120) {
    calonJudul = calonJudul.substring(0, 117) + "...";
  }

  // 2. Ekstraksi Seluruh Tautan Lampiran
  const daftarLink = ekstrakUrlDanKonteks(teks);

  // 3. Ekstraksi Ringkasan Poin Singkat (TL;DR)
  // Ambil 1-2 kalimat deskriptif pertama yang bukan link
  const kalimatDeskriptif = barisList
    .filter((b) => !b.startsWith("http") && !b.startsWith("Link") && b.length > 30)
    .slice(0, 2)
    .join(" ");

  let ringkasan = kalimatDeskriptif
    ? kalimatDeskriptif.substring(0, 250) + (kalimatDeskriptif.length > 250 ? "..." : "")
    : "Pengumuman penting mengenai kegiatan dan informasi terbaru.";

  if (daftarLink.length > 0) {
    ringkasan += ` (Memuat ${daftarLink.length} tautan lampiran)`;
  }

  // 4. Ekstraksi Tag Kategori Otomatis
  const lowerTeks = teks.toLowerCase();
  const tags = ["pengumuman"];
  if (lowerTeks.includes("pens") || lowerTeks.includes("kampus") || lowerTeks.includes("kuliah")) {
    tags.push("akademik");
  }
  if (lowerTeks.includes("sertifikat") || lowerTeks.includes("kelulusan")) {
    tags.push("sertifikat");
  }
  if (lowerTeks.includes("lkmm")) {
    tags.push("lkmm");
  }

  // 5. Canonical Hash untuk deteksi duplikasi pengumuman yang sama persis
  const normalisasiTeks = (calonJudul + teks.substring(0, 300)).toLowerCase().replace(/\s+/g, "");
  const canonicalHash = crypto.createHash("sha256").update(normalisasiTeks).digest("hex");

  return {
    tipe: "pengumuman",
    kategori: tags.includes("akademik") ? "akademik" : "pengumuman",
    judul: calonJudul,
    ringkasan: ringkasan,
    payload: teks.trim(), // Teks lengkap pengumuman disimpan utuh
    canonical_hash: canonicalHash,
    tags: tags,
    metadata_links: daftarLink,
  };
}
