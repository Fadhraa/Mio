/**
 * activityAggregator.js
 * Service untuk mengagregasi data aktivitas mentah dari SQLite menjadi ringkasan statistik berbobot token kecil.
 */

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "../sql", "activity.sqlite");

// Format durasi detik ke format jam dan menit yang ramah dibaca
function formatDurationReadable(seconds) {
  if (seconds < 60) return `${seconds} detik`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}

// Mengambil dan mengagregasi log mentah dari SQLite
function fetchAndAggregateDailyActivities(targetDate = null) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DB_PATH)) {
      return reject(new Error("Database SQLite tidak ditemukan di " + DB_PATH));
    }

    const db = new sqlite3.Database(DB_PATH);
    const today = new Date().toISOString().slice(0, 10);
    const selectedDate = targetDate || today;

    let query;
    let queryParams = [];

    if (targetDate) {
      query = `
        SELECT id, category, app, window_title, duration, hours_of_day, start_time
        FROM raw_activities
        WHERE session_id IS NULL 
          AND date(created_at, 'localtime') = ?
        ORDER BY id ASC
      `;
      queryParams = [targetDate];
    } else {
      query = `
        SELECT id, category, app, window_title, duration, hours_of_day, start_time
        FROM raw_activities
        WHERE session_id IS NULL 
           OR date(created_at, 'localtime') = date('now', 'localtime')
           OR date(created_at) = date('now')
        ORDER BY id ASC
      `;
    }

    db.all(query, queryParams, (err, rows) => {
      if (err) {
        db.close();
        return reject(err);
      }

      // Fallback untuk manual CLI testing jika hari ini kosong
      if (!rows || rows.length === 0) {
        if (!targetDate) {
          db.all(
            `SELECT id, category, app, window_title, duration, hours_of_day, start_time 
             FROM raw_activities 
             ORDER BY id DESC LIMIT 50`,
            [],
            (err2, fallbackRows) => {
              db.close();
              if (err2) return reject(err2);
              if (!fallbackRows || fallbackRows.length === 0) return resolve(null);
              processRows(fallbackRows.reverse());
            }
          );
        } else {
          db.close();
          return resolve(null);
        }
      } else {
        db.close();
        processRows(rows);
      }

      function processRows(targetRows) {
        const rowIds = targetRows.map((r) => r.id);
        let totalDuration = 0;
        const categoryMap = {};
        const appMap = {};
        const hourMap = {};
        const sampleTitles = new Set();

        for (const r of targetRows) {
          const dur = r.duration || 0;
          if (dur <= 0) continue;
          totalDuration += dur;

          categoryMap[r.category] = (categoryMap[r.category] || 0) + dur;
          appMap[r.app] = (appMap[r.app] || 0) + dur;

          const hr = r.hours_of_day !== undefined ? r.hours_of_day : 0;
          hourMap[hr] = (hourMap[hr] || 0) + dur;

          if (r.window_title && sampleTitles.size < 20) {
            sampleTitles.add(r.window_title.slice(0, 70));
          }
        }

        if (totalDuration < 30) {
          return resolve(null);
        }

        const sortedCategories = Object.entries(categoryMap)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, d]) => ({
            category: cat,
            duration_seconds: d,
            formatted: formatDurationReadable(d),
            percentage: Math.round((d / totalDuration) * 100) + "%",
          }));

        const sortedApps = Object.entries(appMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([app, d]) => ({
            app,
            duration_seconds: d,
            formatted: formatDurationReadable(d),
          }));

        const sortedHours = Object.entries(hourMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hr]) => `${hr}:00`);

        resolve({
          date: selectedDate,
          row_ids: rowIds,
          total_duration_seconds: totalDuration,
          total_formatted: formatDurationReadable(totalDuration),
          categories: sortedCategories,
          top_apps: sortedApps,
          peak_hours: sortedHours,
          titles: Array.from(sampleTitles),
        });
      }
    });
  });
}

module.exports = {
  fetchAndAggregateDailyActivities,
  formatDurationReadable,
  DB_PATH,
};
