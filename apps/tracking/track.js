const activeWindow = require("active-win");
const { summarizeActivities } = require("./ai_models/model");
const { getCategory } = require("./tools/get_category");
const {
  saveSessionToDB,
  saveLearnedCategory,
  loadLearnedCategories,
  deleteSession,
  deleteLearnedCategory,
  clearAllSessions,
  clearAllLearnedCategories,
  saveRawActivityToDB
} = require("./sql/db");
const http = require("http");
const { generateHtml } = require("./generate_html");
const { getIdleTimeSeconds } = require("./tools/afk_detection");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
// TCP Server
const { startTcpServer, broadcastOverlayStatus } = require("./tcp_server/tcp_server");
const IDLE_THRESHOLD = 60 * 1000; // 1 menit (dalam milidetik)
const RAW_LOG_DIR = path.join(__dirname, "logs");
const RAW_LOG_FILE = path.join(RAW_LOG_DIR, "raw_logs.json");

const SESSION_DIR = path.join(__dirname, "sessions");
// cache memori learned categories
let learnedCategoriesCache = {};
loadLearnedCategories().then(data => {
  learnedCategoriesCache = data;
  console.log(`[Memory] berhasil memuat ${Object.keys(data).length} kategori dari memori belajar Ai`);
}).catch(err => {
  console.log(`[Memory] Gagal memuat kategori :${err}`)
})
// AFK VARIABEL
let statusAFK = "";
let lastidleTime = 0;
// Variabel log with Ai
let isProcessingAI = false;
const TEMP_LOG_FILE = path.join(RAW_LOG_DIR, "raw_logs_temp.json");
// System recovery 
if (fs.existsSync(TEMP_LOG_FILE)) {
  try {
    const failedData = fs.readFileSync(TEMP_LOG_FILE, "utf-8");
    fs.appendFileSync(RAW_LOG_FILE, failedData, "utf-8");
    fs.unlinkSync(TEMP_LOG_FILE);
    console.log("[Recovery] Log berhasil dipulihkan");
  } catch (err) {
    console.error("Gagal memulihkan log:", err);
  }
}
// Raw logs counter
let rawLogCounter = 0;
if (fs.existsSync(RAW_LOG_FILE)) {
  try {
    const fileContent = fs.readFileSync(RAW_LOG_FILE, "utf-8").trim();
    rawLogCounter = fileContent ? fileContent.split("\n").filter(line => line.trim() !== "").length : 0;
    console.log(`[Memory] Terdeteksi ${rawLogCounter} baris log mentah di awal.`);
  } catch (err) {
    console.error("Gagal membaca jumlah baris log awal:", err);
  }
}
// Pastikan folder session ada, jika tidak buat
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR);
}
if (!fs.existsSync(RAW_LOG_DIR)) {
  fs.mkdirSync(RAW_LOG_DIR);
}
// State
let currentActivity = null;
let lastTickTime = Date.now();
const MIN_DURATION_SECONDS = 15;
// APLIKASI YANG DIABAIKAN
const IGNORED_APPS = [
  "SearchHost",              // Windows Search
  "StartMenuExperienceHost", // Start Menu
  "LockApp",                 // Windows Lock Screen
  "ShellExperienceHost",     // Elemen UI Windows lainnya
  "ScreenClippingHost",      // Snipping Tool / Screenshot
  "Microsoft.Notes",         // Sticky Notes
  "ActionCenter"
];
// overlay
let overlayProcess = null;
const OVERLAY_STATUS_FILE = path.join(RAW_LOG_DIR, "overlay_status.json");

// function format durasi
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} detik`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let result = "";
  if (hours > 0) result += `${hours} jam `;
  if (minutes > 0) result += `${minutes} menit `;
  if (remainingSeconds > 0 && hours === 0)
    result += `${remainingSeconds} detik`;

  return result.trim();
}
// Fungsi untuk membaca dan menyimpan log ke file JSON
function saveRawLog(activity) {
  // Ubah objek jadi satu baris string + newline (\n)
  const logLine = JSON.stringify(activity) + "\n";
  try {
    fs.appendFileSync(RAW_LOG_FILE, logLine, "utf-8");
    console.log(`[Tersimpan] ${activity.category} -> ${activity.app}`);

    // TINGKATKAN COUNTER DI MEMORI (SANGAT RINGAN)
    rawLogCounter++;

    // Cukup gunakan variabel counter di memori
    if (rawLogCounter >= 40 && !isProcessingAI) {
      console.log(`\n[Info] Log mencapai ${rawLogCounter} baris, memulai proses AI otomatis...`);
      processLogsWithAI();
    }
  } catch (err) {
    console.error("Gagal menyimpan log:", err);
  }
}
async function processLogsWithAI() {
  if (isProcessingAI) return;
  if (!fs.existsSync(RAW_LOG_FILE)) return;

  const fileContent = fs.readFileSync(RAW_LOG_FILE, "utf-8").trim();
  if (!fileContent) return;
  isProcessingAI = true;
  fs.renameSync(RAW_LOG_FILE, TEMP_LOG_FILE)
  const activities = fs.readFileSync(TEMP_LOG_FILE, "utf-8")
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
  const filteredActivities = activities.filter((log) => log.duration >= 15);
  const mergedActivities = []
  for (const log of filteredActivities) {
    if (mergedActivities.length === 0) {
      mergedActivities.push({ ...log });
      continue;
    }
    const lastlog = mergedActivities[mergedActivities.length - 1];
    if (lastlog.app === log.app && lastlog.category === log.category) {
      lastlog.duration += log.duration;
      if (!lastlog.window_title.includes(log.window_title)) {
        lastlog.window_title += ", " + log.window_title;
      }
    } else {
      mergedActivities.push({ ...log });
    }
  }
  console.log(`\n==== DATA MENTAH ${activities.length} BARIS -> setelah dihemat menjadi ${mergedActivities.length} LOG KE AI====`);
  console.log("Menghubungi AI (NVIDIA NIM) untuk merangkum aktivitas... Harap tunggu sebentar (jangan tutup program)...");
  if (mergedActivities.length === 0) {
    fs.unlinkSync(TEMP_LOG_FILE)
    console.log("[Info] Tidak ada aktivitas yang cukup lama (>15d), membatalkan proses AI")
    rawLogCounter = Math.max(0, rawLogCounter - activities.length);
    isProcessingAI = false;
    return;
  }
  try {
    const aiResult = await summarizeActivities(mergedActivities);
    const sessions = aiResult.sessions || [];
    const learnedMappings = aiResult.learned_mappings || [];

    // 1. Simpan sesi AI dan catat ID yang dihasilkan
    const savedSessions = [];
    for (const session of sessions) {
      const sessionId = await saveSessionToDB(session);
      savedSessions.push({ id: sessionId, data: session });
    }

    // 2. Hubungkan dan simpan log mentah asli ke database
    for (const raw of activities) {
      // Cari sesi AI dengan kategori yang sama
      let candidates = savedSessions.filter(s => s.data.category === raw.category);

      // Jika tidak ada kategori sama, coba cari sesi yang menggunakan aplikasi ini
      if (candidates.length === 0) {
        candidates = savedSessions.filter(s => {
          const apps = s.data.apps_used || [];
          return apps.includes(raw.app);
        });
      }

      // Jika masih kosong, gunakan semua sesi yang ada
      if (candidates.length === 0) {
        candidates = savedSessions;
      }

      if (candidates.length > 0) {
        // Cari sesi terdekat secara waktu
        const rTime = new Date(raw.startTimeMs);
        const rMinutes = rTime.getHours() * 60 + rTime.getMinutes();

        let bestSession = candidates[0];
        let minDiff = Infinity;

        for (const cand of candidates) {
          const timeParts = (cand.data.start_time || "00:00").split(":");
          const sMinutes = parseInt(timeParts[0] || 0) * 60 + parseInt(timeParts[1] || 0);
          const diff = Math.abs(rMinutes - sMinutes);
          if (diff < minDiff) {
            minDiff = diff;
            bestSession = cand;
          }
        }

        await saveRawActivityToDB(raw, bestSession.id);
      }
    }

    for (const mapping of learnedMappings) {
      if (mapping.app && mapping.category) {
        await saveLearnedCategory(mapping.app, mapping.category);
        learnedCategoriesCache[mapping.app] = mapping.category;
        console.log(`[AI Auto-Learn] Berhasil mempelajari aplikasi baru: ${mapping.app} -> ${mapping.category}`);
      }
    }
    fs.unlinkSync(TEMP_LOG_FILE);
    rawLogCounter = Math.max(0, rawLogCounter - activities.length);
    console.log("[Success] Log berhasil dirapikan dan disimpan ke database (termasuk arsip data mentah)")
  } catch (error) {
    console.error("Gagal memproses AI log dikembalikan ke agar di proses nanti", error)
    const failedData = fs.readFileSync(TEMP_LOG_FILE, "utf-8");
    fs.appendFileSync(RAW_LOG_FILE, failedData + "\n");
    fs.unlinkSync(TEMP_LOG_FILE);
  }
  finally {
    isProcessingAI = false;
  }

}

// Fungsi untuk menulis data real-time ke JSON
function updateOverlayStatus(category, app, duration, isIdle) {
  const statusFile = path.join(__dirname, "logs", "overlay_status.json");
  const data = {
    category,
    app,
    duration,
    is_idle: isIdle,
    updatedAt: Date.now() // <-- Tambahkan timestamp milidetik UTC/Lokal sekarang
  };
  broadcastOverlayStatus(data)
}


// Fungsi untuk menyalakan GUI PowerShell
function startOverlay() {
  const exePath = path.join(__dirname, "tools", "overlay", "overlay.exe");
  const csPath = path.join(__dirname, "tools", "overlay", "overlay.cs");
  // 1. Jika file .exe belum ada, kompilasi file C# secara otomatis
  if (fs.existsSync(csPath) && !fs.existsSync(exePath)) {
    console.log("[Overlay C#] Mengompilasi file overlay.cs menjadi overlay.exe...");
    const cscPath = "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe";
    try {
      // Menyertakan referensi library WPF agar kompilator mengenali elemen UI
      const refs = [
        `"C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\PresentationFramework.dll"`,
        `"C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\PresentationCore.dll"`,
        `"C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\WindowsBase.dll"`,
        `"System.dll"`,
        `"System.Core.dll"`,
        `"System.Xaml.dll"`
      ].map(r => `/r:${r}`).join(" ");
      // Jalankan perintah kompilasi dengan referensi lengkap
      execSync(`"${cscPath}" /target:winexe ${refs} /out:"${exePath}" "${csPath}"`);
      console.log("[Overlay C#] Kompilasi berhasil!");
    } catch (err) {
      console.error("[Overlay C#] Gagal mengompilasi C#. Menggunakan fallback PowerShell...", err.message);
    }
  }
  // 2. Jalankan overlay.exe jika ada, atau gunakan overlay.ps1 sebagai cadangan
  if (fs.existsSync(exePath)) {
    console.log("[Overlay] Menjalankan C# Overlay GUI...");
    overlayProcess = spawn(exePath);
  } else {
    console.log("[Overlay] Menggunakan fallback PowerShell Overlay GUI...");
    const scriptPath = path.join(__dirname, "tools", "overlay", "overlay.ps1");
    overlayProcess = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-STA",
      "-WindowStyle", "Hidden",
      "-File", scriptPath
    ]);
  }
  overlayProcess.stderr.on("data", (data) => {
    console.error(`[Overlay Error]: ${data.toString()}`);
  });
  overlayProcess.on("error", (err) => {
    console.error("Gagal menjalankan overlay GUI:", err);
  });
}



async function trackActivity() {
  const window = await activeWindow();
  const now = Date.now();
  const idleTimeSeconds = getIdleTimeSeconds();

  // Toleransi AFK Normal (Misal: 60 detik. Untuk testing biarkan 10 detik)
  let batasWaktuAFK = 60;

  // Jika sedang menonton YouTube/Netflix atau mendengarkan musik, toleransi ditingkatkan menjadi 2 Jam (7200 detik)!
  if (
    currentActivity &&
    (currentActivity.category === "NONTON" ||
      currentActivity.category === "MUSIC")
  ) {
    batasWaktuAFK = 7200;
  }

  // 1. JIKA USER SEDANG AFK / IDLE
  if (idleTimeSeconds >= batasWaktuAFK) {
    console.log(idleTimeSeconds, statusAFK);
    statusAFK = "AFK";
    lastidleTime = idleTimeSeconds;
    if (currentActivity) {
      const exactEndMs = now - (idleTimeSeconds * 1000);
      currentActivity.end = new Date(exactEndMs).toLocaleTimeString([], { hour12: false });
      currentActivity.duration = Math.floor(
        (exactEndMs - currentActivity.startTimeMs) / 1000,
      );
      if (currentActivity.duration > MIN_DURATION_SECONDS) {
        saveRawLog(currentActivity);
      }
      currentActivity = null;
    }
    // Update status overlay menjadi AFK sebelum keluar fungsi
    updateOverlayStatus("IDLE / AFK", "Layar tidak aktif", 0, true);
    return;
  } else if (idleTimeSeconds === 0 && statusAFK === "AFK") {
    console.log("kamu afk selama:", formatDuration(lastidleTime));
    statusAFK = "ACTIVE";
    lastidleTime = 0;
  }

  if (now - lastTickTime > IDLE_THRESHOLD) {
    // Jika idle, kita simpan aktivitas terakhir tapi TIDAK panggil AI
    if (currentActivity) {
      currentActivity.end = new Date(lastTickTime).toLocaleTimeString([], { hour12: false });
      currentActivity.duration = Math.floor(
        (lastTickTime - currentActivity.startTimeMs) / 1000,
      );
      if (currentActivity.duration > 0) {
        saveRawLog(currentActivity);
      }
      currentActivity = null; // Kosongkan, nunggu aktif lagi
    }
  }
  lastTickTime = now;

  if (!window) return;

  const appName = window.owner.name;
  const windowTitle = window.title;
  const isIgnored = IGNORED_APPS.some(ignored => appName.includes(ignored))
  if (isIgnored) {
    return
  }
  // 2. DETEKSI PERPINDAHAN WINDOW / APLIKASI
  if (
    !currentActivity ||
    currentActivity.app !== appName ||
    currentActivity.window_title !== windowTitle
  ) {
    // Kalau sebelumnya sudah ada aktivitas, simpan log mentahnya
    if (currentActivity) {
      currentActivity.end = new Date(now).toLocaleTimeString();
      currentActivity.duration = Math.floor(
        (now - currentActivity.startTimeMs) / 1000,
      );
      if (currentActivity.duration > MIN_DURATION_SECONDS) {
        saveRawLog(currentActivity);
      } else {
        console.log(`[Abaikan] Aktivitas terlalu singkat (${currentActivity.duration}s): ${currentActivity.app}`);
      }
    }

    const cacheCategory = learnedCategoriesCache[appName];
    const dateObj = new Date(now);

    // Buat objek aktivitas yang baru
    currentActivity = {
      category: cacheCategory || getCategory(appName, windowTitle),
      project_context: "Unknown",
      app: appName,
      window_title: windowTitle,
      day_of_week: dateObj.toLocaleDateString("id-ID", {
        weekday: "long",
      }),
      hours_of_day: dateObj.getHours(),
      start: new Date(now).toLocaleTimeString(),
      startTimeMs: now,
      end: null,
      duration: 0,
    };

    console.log(
      `[${currentActivity.start}] [ Aktif ] -> ${appName} : ${windowTitle} `,
    );
  }

  // 3. DI AKHIR SETIAP TICK (SELALU UPDATE OVERLAY JIKA AKTIF)
  if (currentActivity) {
    const durationSeconds = Math.floor((now - currentActivity.startTimeMs) / 1000);
    updateOverlayStatus(
      currentActivity.category,
      currentActivity.app,
      durationSeconds,
      false // isIdle = false
    );
  }
}


setInterval(trackActivity, 3000);
let isExiting = false;
process.on("SIGINT", async () => {
  if (isExiting) {
    console.log("[Info] Sedang memproses AI di latar belakang, harap tunggu sebentar...");
    return;
  }
  isExiting = true;

  if (overlayProcess) {
    overlayProcess.kill();
  }
  console.log("\nMematikan program, menyimpan sisa aktivitas...");

  // Simpan aktivitas terakhir yang sedang berjalan sebelum dimatikan
  if (currentActivity) {
    const now = Date.now();
    currentActivity.end = new Date(now).toLocaleTimeString();
    currentActivity.duration = Math.floor(
      (now - currentActivity.startTimeMs) / 1000,
    );
    if (currentActivity.duration > MIN_DURATION_SECONDS) {
      saveRawLog(currentActivity);
    } else {
      console.log(`[Abaikan] Aktivitas terlalu singkat (${currentActivity.duration}s): ${currentActivity.app}`);
    }
  }

  // Panggil AI secara batch untuk seluruh file raw_log.json
  await processLogsWithAI();

  if (apiServer) {
    apiServer.close();
  }
  process.exit();
});


// server
const API_PORT = 5005;
const apiServer = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};

        if (req.url === "/api/delete-session") {
          if (parsedBody.id) {
            await deleteSession(parsedBody.id);
            await generateHtml();
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Session deleted successfully");
          } else {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Missing ID");
          }
        }
        else if (req.url === "/api/delete-learned") {
          if (parsedBody.id) {
            await deleteLearnedCategory(parsedBody.id);
            learnedCategoriesCache = await loadLearnedCategories();
            await generateHtml();
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Learned category deleted successfully");
          } else {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Missing ID");
          }
        }
        else if (req.url === "/api/clear-sessions") {
          await clearAllSessions();
          await generateHtml();
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("All sessions cleared");
        }
        else if (req.url === "/api/clear-learned") {
          await clearAllLearnedCategories();
          learnedCategoriesCache = {};
          await generateHtml();
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("All learned categories cleared");
        }
        else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        }
      } catch (err) {
        console.error("API Error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error: " + err.message);
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});
apiServer.listen(API_PORT, () => {
  console.log(`[API Server] Mendengarkan perintah hapus di http://localhost:${API_PORT}`);
});

startTcpServer(5006);
startOverlay();
