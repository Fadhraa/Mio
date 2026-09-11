const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Buat folder sql jika belum ada (Opsional)
const SQL_DIR = __dirname;
if (!fs.existsSync(SQL_DIR)) {
  fs.mkdirSync(SQL_DIR);
}

// Sambungkan ke file database bernama activity.sqlite
const dbPath = path.join(SQL_DIR, "activity.sqlite");
const db = new sqlite3.Database(dbPath);

// Otomatis membuat tabel-tabel jika belum ada
db.serialize(() => {
  // Aktifkan dukungan foreign key cascade di SQLite
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      day_of_week TEXT,
      hour_of_day INTEGER,
      start_time TEXT,
      total_duration_seconds INTEGER,
      apps_used TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS learned_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT UNIQUE,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS raw_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      category TEXT,
      project_context TEXT,
      app TEXT,
      window_title TEXT,
      day_of_week TEXT,
      hours_of_day INTEGER,
      start_time TEXT,
      duration INTEGER,
      startTimeMs INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
});

// Fungsi untuk memasukkan rangkuman JSON dari AI ke Database
function saveSessionToDB(sessionData) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO sessions 
      (category, day_of_week, hour_of_day, start_time, total_duration_seconds, apps_used, summary) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionData.category || "Unknown",
      sessionData.day_of_week,
      sessionData.hour_of_day,
      sessionData.start_time,
      sessionData.total_duration_seconds,
      JSON.stringify(sessionData.apps_used || []), // Karena SQLite tidak mendukung array, kita jadikan teks
      sessionData.summary,
      function (err) {
        if (err) {
          console.error("[Error] Gagal simpan ke DB SQLite:", err.message);
          reject(err);
        } else {
          console.log(`[DB Sukses] Sesi ${sessionData.category} tersimpan ke SQLite!`);
          resolve(this.lastID);
        }
      }
    );
    stmt.finalize();
  });
}

// Fungsi untuk menyimpan log aktivitas mentah ke Database
function saveRawActivityToDB(rawActivity, sessionId) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO raw_activities 
      (session_id, category, project_context, app, window_title, day_of_week, hours_of_day, start_time, duration, startTimeMs) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      rawActivity.category || "Unknown",
      rawActivity.project_context || "Unknown",
      rawActivity.app || "Unknown",
      rawActivity.window_title || "Unknown",
      rawActivity.day_of_week,
      rawActivity.hours_of_day || 0,
      rawActivity.start || "",
      rawActivity.duration || 0,
      rawActivity.startTimeMs || 0,
      function (err) {
        if (err) {
          console.error("[DB Error] Gagal simpan raw activity ke SQLite:", err.message);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
    stmt.finalize();
  });
}
// Menyimpan aplikasi yang telah dikategorikan oleh AI
function saveLearnedCategory(appName, category) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO learned_categories (app_name, category)
      VALUES (?, ?)
    `);
    stmt.run(appName, category, function (err) {
      if (err) {
        console.error("[DB Error] Gagal simpan learned category:", err.message);
        reject(err);
      } else {
        resolve();
      }
    });
    stmt.finalize();
  });
}

// Mengambil semua data untuk dimasukkan ke memori RAM saat program start
function loadLearnedCategories() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT app_name, category FROM learned_categories`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const cache = {};
        rows.forEach(row => {
          cache[row.app_name] = row.category;
        });
        resolve(cache);
      }
    });
  });
}

function deleteSession(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM sessions WHERE id = ?", [id], function (err) {
      if (err) {
        console.error("[DB Error] Gagal menghapus session:", err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function deleteLearnedCategory(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM learned_categories WHERE id = ?", [id], function (err) {
      if (err) {
        console.error("[DB Error] Gagal menghapus learned category:", err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function clearAllSessions() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM sessions", [], function (err) {
      if (err) {
        console.error("[DB Error] Gagal mengosongkan sessions:", err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function clearAllLearnedCategories() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM learned_categories", [], function (err) {
      if (err) {
        console.error("[DB Error] Gagal mengosongkan learned categories:", err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  saveSessionToDB,
  loadLearnedCategories,
  saveLearnedCategory,
  deleteSession,
  deleteLearnedCategory,
  clearAllSessions,
  clearAllLearnedCategories,
  saveRawActivityToDB,
  db,
};
