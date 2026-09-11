import fs from "fs";
import path from "path";
import crypto from "crypto";
import { BULAN_INDO, HARI_INDO } from "../functions/helper/parse_tanggal.js";
import { JADWAL_PATH } from "../paths.js";


// In-memory cache
let cachedJadwal = null;
let lastLoadedTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 menit TTL jika tidak ada mutasi

/**
 * Format objek Date menjadi "DD Bulan YYYY" dalam bahasa Indonesia
 */
export function formatTanggalIndo(date) {
  const tgl = date.getDate().toString().padStart(2, "0");
  const bulanList = Object.keys(BULAN_INDO);
  const bulan = bulanList[date.getMonth()];
  const tahun = date.getFullYear();
  return `${tgl} ${bulan} ${tahun}`;
}

/**
 * Membaca semua jadwal dengan in-memory cache
 */
export function bacaSemuaJadwal(forceReload = false) {
  const sekarang = Date.now();
  if (!forceReload && cachedJadwal !== null && sekarang - lastLoadedTime < CACHE_TTL_MS) {
    return cachedJadwal;
  }

  if (!fs.existsSync(JADWAL_PATH)) {
    cachedJadwal = [];
    lastLoadedTime = sekarang;
    return cachedJadwal;
  }

  try {
    const raw = fs.readFileSync(JADWAL_PATH, "utf-8");
    cachedJadwal = raw ? JSON.parse(raw) : [];
    lastLoadedTime = sekarang;
    return cachedJadwal;
  } catch (err) {
    console.error("[JADWAL SERVICE ERROR bacaSemuaJadwal]:", err);
    return cachedJadwal || [];
  }
}

/**
 * Menyimpan array jadwal ke disk secara atomik dan memperbarui in-memory cache
 */
export function simpanSemuaJadwal(semuaJadwal) {
  try {
    const dirPath = path.dirname(JADWAL_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(JADWAL_PATH, JSON.stringify(semuaJadwal, null, 2), "utf-8");
    cachedJadwal = semuaJadwal;
    lastLoadedTime = Date.now();
    return true;
  } catch (err) {
    console.error("[JADWAL SERVICE ERROR simpanSemuaJadwal]:", err);
    return false;
  }
}

/**
 * Evaluasi daftar jadwal untuk satu tanggal tertentu dengan status dinamis
 */
export function getJadwalByTanggal(semuaJadwal, targetDate, isHariIni = false, sekarang = new Date()) {
  const tglStr = formatTanggalIndo(targetDate);
  const hariName = HARI_INDO[targetDate.getDay()];

  // Saring jadwal yang jatuh pada tanggal/hari ini
  const jadwalHariIni = semuaJadwal.filter((item) => {
    if (item.frekuensi === "harian") return true;
    if (item.frekuensi === "mingguan" && item.hari === hariName) return true;
    if (item.frekuensi === "sekali_saja" && item.tanggal === tglStr) return true;
    return false;
  });

  // Urutkan kronologis berdasarkan jam mulai
  jadwalHariIni.sort((a, b) => {
    const [jamA, minA] = (a.jam_mulai || a.jam || "00:00").split(":").map(Number);
    const [jamB, minB] = (b.jam_mulai || b.jam || "00:00").split(":").map(Number);
    return jamA * 60 + minA - (jamB * 60 + minB);
  });

  let databaseBerubah = false;
  const jamSekarang = sekarang.getHours();
  const menitSekarang = sekarang.getMinutes();
  const menitTotalSekarang = jamSekarang * 60 + menitSekarang;

  const itemsDenganStatus = jadwalHariIni.map((item, index) => {
    if (!isHariIni) {
      return { ...item, status: "pending" };
    }

    const [jamMulai, menitMulai] = (item.jam_mulai || item.jam || "00:00").split(":").map(Number);
    const menitStart = jamMulai * 60 + menitMulai;
    const durasiDefault = item.durasi || 120;
    let menitEnd = menitStart + durasiDefault;

    // Sesuaikan batas durasi jika berhimpitan dengan jadwal berikutnya
    if (index < jadwalHariIni.length - 1) {
      const [nextJam, nextMenit] = (jadwalHariIni[index + 1].jam_mulai || jadwalHariIni[index + 1].jam || "00:00")
        .split(":")
        .map(Number);
      const nextStart = nextJam * 60 + nextMenit;
      if (nextStart < menitEnd) {
        menitEnd = nextStart;
      }
    }

    let statusDinamis = "pending";
    if (menitTotalSekarang >= menitStart && menitTotalSekarang < menitEnd) {
      statusDinamis = "active";
    } else if (menitTotalSekarang >= menitEnd) {
      statusDinamis = "completed";
    }

    // Auto-Arsip jika jadwal sekali_saja untuk hari ini sudah terlewati
    if (
      item.frekuensi === "sekali_saja" &&
      statusDinamis === "completed" &&
      item.status !== "completed"
    ) {
      const itemAsli = semuaJadwal.find((j) => j.id === item.id);
      if (itemAsli) {
        itemAsli.status = "completed";
        databaseBerubah = true;
      }
    }

    return { ...item, status: statusDinamis };
  });

  return { items: itemsDenganStatus, databaseBerubah };
}

/**
 * Mengambil daftar jadwal hari ini dengan status dinamis
 */
export function getJadwalHariIni(sekarang = new Date()) {
  const semuaJadwal = bacaSemuaJadwal();
  const { items, databaseBerubah } = getJadwalByTanggal(semuaJadwal, sekarang, true, sekarang);

  if (databaseBerubah) {
    simpanSemuaJadwal(semuaJadwal);
  }

  return items;
}

/**
 * Mengambil daftar jadwal mingguan (7 hari ke depan) terkelompok per hari
 */
export function getJadwalMingguan(sekarang = new Date()) {
  const semuaJadwal = bacaSemuaJadwal();
  const hasilMingguan = [];
  let totalDatabaseBerubah = false;

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(sekarang);
    targetDate.setDate(sekarang.getDate() + i);

    const isHariIni = i === 0;
    const tglStr = formatTanggalIndo(targetDate);
    const hariName = HARI_INDO[targetDate.getDay()];

    const { items, databaseBerubah } = getJadwalByTanggal(semuaJadwal, targetDate, isHariIni, sekarang);
    if (databaseBerubah) totalDatabaseBerubah = true;

    hasilMingguan.push({
      tanggal: tglStr,
      hari: hariName,
      is_hari_ini: isHariIni,
      items,
    });
  }

  if (totalDatabaseBerubah) {
    simpanSemuaJadwal(semuaJadwal);
  }

  return hasilMingguan;
}

/**
 * Mengambil agenda yang relevan untuk AI Briefing (sedang berlangsung atau akan datang dalam X menit)
 */
export function getJadwalRelevanBriefing(sekarang = new Date(), jendelaMenit = 180) {
  const jadwalHariIni = getJadwalHariIni(sekarang);
  const menitSekarang = sekarang.getHours() * 60 + sekarang.getMinutes();
  const batasMenitMaksimal = menitSekarang + jendelaMenit;
  const kegiatanRelevan = [];

  for (const item of jadwalHariIni) {
    const jamStr = item.jam_mulai || item.jam || "00:00";
    const [j, m] = jamStr.split(":").map(Number);
    const menitMulai = j * 60 + m;
    const durasi = item.durasi || 60;
    const menitSelesai = menitMulai + durasi;

    const isSedangBerjalan = menitSekarang >= menitMulai && menitSekarang < menitSelesai;
    const isAkanDatang = menitMulai >= menitSekarang && menitMulai <= batasMenitMaksimal;

    if (isSedangBerjalan) {
      kegiatanRelevan.push({
        status: "sedang_berlangsung",
        judul: item.judul || item.kegiatan,
        jam: jamStr,
        ruangan: item.ruangan,
        dosen: item.dosen,
      });
    } else if (isAkanDatang) {
      kegiatanRelevan.push({
        status: "segera_datang",
        judul: item.judul || item.kegiatan,
        jam: jamStr,
        ruangan: item.ruangan,
        dosen: item.dosen,
      });
    }
  }

  return { jadwalHariIni, kegiatanRelevan };
}

/**
 * Helper untuk menambah jadwal baru ke sistem
 */
export function tambahJadwalService(params) {
  const {
    title,
    category,
    frequency,
    day,
    date,
    startTime,
    endTime,
    lecturer,
    room,
    session,
  } = params;

  let durasiMenit = 60;
  try {
    const [h1, m1] = startTime.split(":").map(Number);
    const [h2, m2] = endTime.split(":").map(Number);
    durasiMenit = h2 * 60 + m2 - (h1 * 60 + m1);
  } catch (e) {}

  const semuaJadwal = bacaSemuaJadwal(true);
  const jadwalBaru = {
    id: `jdw_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`,
    kategori: category || "rutinitas",
    judul: title,
    dosen: lecturer || null,
    ruangan: room || null,
    frekuensi: frequency || "mingguan",
    hari: frequency !== "sekali_saja" ? day : null,
    tanggal: frequency === "sekali_saja" ? date : null,
    jam_mulai: startTime,
    jam_selesai: endTime,
    durasi: durasiMenit,
    sesi_ke: session || null,
    status: "aktif",
    dicatat_pada: new Date().toISOString(),
  };

  semuaJadwal.push(jadwalBaru);
  simpanSemuaJadwal(semuaJadwal);
  return jadwalBaru;
}

/**
 * Helper untuk menghapus jadwal berdasarkan ID
 */
export function hapusJadwalService(id) {
  const semuaJadwal = bacaSemuaJadwal(true);
  const index = semuaJadwal.findIndex((j) => j.id === id);
  if (index === -1) {
    return null;
  }

  const [dihapus] = semuaJadwal.splice(index, 1);
  simpanSemuaJadwal(semuaJadwal);
  return dihapus;
}
