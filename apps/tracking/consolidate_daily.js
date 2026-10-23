/**
 * consolidate_daily.js
 * Orchestrator Utama Konsolidasi Harian Cerdas (Daily Activity Consolidation).
 * Mengorkestrasi: Aggregator -> Gemini AI Reflection -> SQLite DB -> Habit Memory -> Viewer HTML.
 */

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const { saveSessionToDB } = require("./sql/db");
const { generateHtml } = require("./generate_html");
const { fetchAndAggregateDailyActivities, DB_PATH } = require("./services/activityAggregator");
const { generateDailyReflection } = require("./services/geminiService");
const { updateHabitMemory } = require("./services/habitService");
const {
  catchupUnconsolidatedActivities,
  startConsolidationScheduler,
} = require("./services/schedulerService");

// Eksekusi Utama Konsolidasi
async function runDailyConsolidation(targetDate = null) {
  console.log("==================================================");
  console.log("   MIO DAILY TRACKING CONSOLIDATION WORKER       ");
  console.log("==================================================");
  console.log(`[1/4] Mengambil & meringkas aktivitas ${targetDate ? targetDate : "hari ini"} dari SQLite...`);

  const aggregated = await fetchAndAggregateDailyActivities(targetDate);
  if (!aggregated) {
    console.log(`[Info] Tidak ada log aktivitas yang cukup untuk dikonsolidasi (${targetDate || "hari ini"}).`);
    return;
  }

  console.log(`[Sukses] Total durasi aktif: ${aggregated.total_formatted}`);
  console.log(`Kategori teratas: ${aggregated.categories.map((c) => `${c.category} (${c.percentage})`).join(", ")}`);
  console.log(`Aplikasi teratas: ${aggregated.top_apps.map((a) => a.app).join(", ")}`);

  console.log("\n[2/4] Menghubungi Google Gemini 3.5 Flash (1x Single Call) dengan PII Masking...");
  const aiResult = await generateDailyReflection(aggregated);

  console.log("\n--- HASIL REFLEKSI HARIAN ---");
  console.log(`Kategori Utama : ${aiResult.category}`);
  console.log(`Rangkuman      : ${aiResult.summary}`);
  if (aiResult.matched_habit_keys && aiResult.matched_habit_keys.length > 0) {
    console.log(`Kebiasaan Lama Diperkuat: ${aiResult.matched_habit_keys.join(", ")}`);
  }
  if (aiResult.detected_new_habits && aiResult.detected_new_habits.length > 0) {
    console.log("Kebiasaan Baru Terdeteksi:");
    aiResult.detected_new_habits.forEach((h) =>
      console.log(`  - [${h.key}] ${h.deskripsi} (Target: ${h.target})`)
    );
  }
  console.log("-----------------------------\n");

  console.log("[3/4] Menyimpan sesi ringkasan ke database SQLite (sessions)...");
  const dateObj = targetDate ? new Date(targetDate) : new Date();
  const sessionData = {
    category: aiResult.category || aggregated.categories[0]?.category || "CODING",
    day_of_week: dateObj.toLocaleDateString("id-ID", { weekday: "long" }),
    hour_of_day: dateObj.getHours(),
    start_time: dateObj.toLocaleTimeString([], { hour12: false }),
    total_duration_seconds: aggregated.total_duration_seconds,
    apps_used: aggregated.top_apps.map((a) => a.app),
    summary: aiResult.summary,
  };

  const sessionId = await saveSessionToDB(sessionData);

  // Hubungkan raw_activities ke sessionId
  if (aggregated.row_ids && aggregated.row_ids.length > 0) {
    const db = new sqlite3.Database(DB_PATH);
    const placeholders = aggregated.row_ids.map(() => "?").join(",");
    db.run(
      `UPDATE raw_activities SET session_id = ? WHERE id IN (${placeholders})`,
      [sessionId, ...aggregated.row_ids],
      (err) => {
        db.close();
        if (err) console.error("[DB Error] Gagal update session_id pada raw_activities:", err.message);
      }
    );
  }

  console.log("[4/4] Memperbarui habit.json dan antarmuka viewer.html...");
  updateHabitMemory(aiResult);
  await generateHtml();

  console.log("\n[SELESAI] Konsolidasi harian sukses! Resource laptop tetap dingin dan ringan.");
}

// Wrapper scheduler yang mengikat runDailyConsolidation
function initScheduler() {
  startConsolidationScheduler(runDailyConsolidation);
}

// Izinkan dijalankan langsung via terminal: `node apps/tracking/consolidate_daily.js`
if (require.main === module) {
  runDailyConsolidation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Consolidation Error]:", err);
      process.exit(1);
    });
}

module.exports = {
  runDailyConsolidation,
  catchupUnconsolidatedActivities: () => catchupUnconsolidatedActivities(runDailyConsolidation),
  startConsolidationScheduler: initScheduler,
};
