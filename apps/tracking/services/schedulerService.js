/**
 * schedulerService.js
 * Service untuk penjadwalan otomatis konsolidasi harian:
 * 1. Startup Catch-Up Reconciler untuk menangani kasus laptop mati sebelum jam 23:00.
 * 2. Sleep-Resilient Heartbeat Scheduler setiap 15 menit untuk trigger jam 23:00.
 */

const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { DB_PATH } = require("./activityAggregator");

let lastConsolidatedDate = null;

// Memeriksa dan memproses sisa log dari hari-hari sebelumnya jika laptop mati kemarin malam
function catchupUnconsolidatedActivities(runConsolidationFn) {
  return new Promise((resolve) => {
    if (!fs.existsSync(DB_PATH)) return resolve();

    const db = new sqlite3.Database(DB_PATH);

    const query = `
      SELECT DISTINCT date(created_at, 'localtime') as log_date
      FROM raw_activities
      WHERE session_id IS NULL 
        AND date(created_at, 'localtime') < date('now', 'localtime')
      ORDER BY log_date ASC
    `;

    db.all(query, [], async (err, rows) => {
      db.close();
      if (err || !rows || rows.length === 0) {
        return resolve();
      }

      console.log(`\n[Catch-Up] Ditemukan aktivitas belum terkonsolidasi dari ${rows.length} hari sebelumnya.`);

      for (const row of rows) {
        console.log(`[Catch-Up] Memproses sisa aktivitas tanggal: ${row.log_date}...`);
        try {
          if (typeof runConsolidationFn === "function") {
            await runConsolidationFn(row.log_date);
          }
        } catch (error) {
          console.error(`[Catch-Up Error] Gagal memproses tanggal ${row.log_date}:`, error.message);
        }
      }

      console.log("[Catch-Up] Seluruh aktivitas masa lalu berhasil disinkronisasi!\n");
      resolve();
    });
  });
}

function startConsolidationScheduler(runConsolidationFn) {
  console.log("[Scheduler] Layanan pemantau konsolidasi harian otomatis aktif.");

  // 1. Jalankan Catch-Up sekali saat startup
  catchupUnconsolidatedActivities(runConsolidationFn).catch((err) => {
    console.error("[Startup Catch-Up Error]:", err.message);
  });

  // 2. Pasang interval pemeriksaan setiap 15 menit (Sangat ringan, CPU ~0%)
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;
  setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours(); // Format 0 - 23
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    if (currentHour >= 23 && lastConsolidatedDate !== todayStr) {
      console.log(`\n[Scheduler] Waktu mencapai pukul ${now.toLocaleTimeString()}. Memulai konsolidasi otomatis...`);
      lastConsolidatedDate = todayStr;
      try {
        if (typeof runConsolidationFn === "function") {
          await runConsolidationFn();
        }
        console.log("[Scheduler] Konsolidasi harian otomatis selesai.");
      } catch (err) {
        console.error("[Scheduler Error] Gagal menjalankan konsolidasi otomatis:", err.message);
        lastConsolidatedDate = null;
      }
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = {
  catchupUnconsolidatedActivities,
  startConsolidationScheduler,
};
