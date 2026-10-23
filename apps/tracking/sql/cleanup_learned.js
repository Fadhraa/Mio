const { db } = require("./db");

const INVALID_ENTRIES = [
  "Microsoft Edge",
  "Windows Explorer",
  "Google Gemini",
  "Desain",
  "Permintaan Lanjutan Adegan Video Belajar",
  "Unggahan",
  "Beranda",
  "Amankan Akun Google dari Peretas",
  "Nonton",
  "Video",
  "baca_informasi.js",
  "assistant - Antigravity IDE - cek_aktivitas.js",
  "assistant - Antigravity IDE - buka_browser.js",
  "assistant - Antigravity IDE - buka_aplikasi.js"
];

function cleanupLearnedCategories() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Hapus entri yang secara eksplisit tidak valid
      const placeholders = INVALID_ENTRIES.map(() => "?").join(",");
      db.run(
        `DELETE FROM learned_categories WHERE app_name IN (${placeholders})`,
        INVALID_ENTRIES,
        function (err) {
          if (err) return reject(err);
          console.log(`[Cleanup] Menghapus ${this.changes} entri blacklist eksplisit.`);
        }
      );

      // 2. Hapus entri yang panjangnya > 35 karakter atau mengandung format tab ' - '
      db.run(
        `DELETE FROM learned_categories WHERE LENGTH(app_name) > 35 OR app_name LIKE '% - %'`,
        [],
        function (err) {
          if (err) return reject(err);
          console.log(`[Cleanup] Menghapus ${this.changes} entri terdeteksi sebagai judul tab.`);
        }
      );

      // 3. Tampilkan entri yang tersisa
      db.all(`SELECT app_name, category FROM learned_categories`, [], (err, rows) => {
        if (err) return reject(err);
        console.log("\n[Cleanup] Entri valid yang tersisa di learned_categories:");
        console.table(rows);
        resolve(rows);
      });
    });
  });
}

cleanupLearnedCategories()
  .then(() => {
    console.log("[Cleanup] Selesai dengan sukses.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[Cleanup Error]:", err);
    process.exit(1);
  });
