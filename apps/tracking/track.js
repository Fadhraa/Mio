/**
 * track.js
 * Core Tracking Daemon:
 * - Memantau window aktif secara real-time setiap 3 detik via active-win.
 * - Deteksi status idle/AFK user.
 * - Mengirim status live ke overlay UI via TCP socket.
 * - Menyimpan aktivitas mentah langsung ke SQLite (zero latency, zero CPU overhead).
 * - Menjalankan Catch-Up Scheduler dan HTTP Management Server.
 */

const fs = require("fs");
const path = require("path");
const activeWindow = require("active-win");
const { spawn, execSync } = require("child_process");

const { getCategory, isBrowserApp } = require("./tools/get_category");
const { getIdleTimeSeconds } = require("./tools/afk_detection");
const { loadLearnedCategories, saveRawActivityDirectly } = require("./sql/db");
const { startConsolidationScheduler } = require("./consolidate_daily");
const { startTrackingApiServer } = require("./services/trackingApiServer");
const { startTcpServer, broadcastOverlayStatus } = require("./tcp_server/tcp_server");

const IDLE_THRESHOLD = 60 * 1000; // 1 menit (dalam milidetik)
const MIN_DURATION_SECONDS = 15;
const RAW_LOG_DIR = path.join(__dirname, "logs");
const RAW_LOG_FILE = path.join(RAW_LOG_DIR, "raw_logs.json");
const SESSION_DIR = path.join(__dirname, "sessions");

// Pastikan folder log dan session ada
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);
if (!fs.existsSync(RAW_LOG_DIR)) fs.mkdirSync(RAW_LOG_DIR);

// Cache memori learned categories
let learnedCategoriesCache = {};
loadLearnedCategories()
  .then((data) => {
    learnedCategoriesCache = data;
    console.log(`[Memory] Berhasil memuat ${Object.keys(data).length} kategori dari memori belajar AI.`);
  })
  .catch((err) => {
    console.log(`[Memory] Gagal memuat kategori: ${err}`);
  });

// State tracker
let statusAFK = "";
let lastidleTime = 0;
let currentActivity = null;
let lastTickTime = Date.now();
let overlayProcess = null;
let rawLogCounter = 0;

// Hitung log mentah di awal
if (fs.existsSync(RAW_LOG_FILE)) {
  try {
    const fileContent = fs.readFileSync(RAW_LOG_FILE, "utf-8").trim();
    rawLogCounter = fileContent ? fileContent.split("\n").filter((l) => l.trim() !== "").length : 0;
    console.log(`[Memory] Terdeteksi ${rawLogCounter} baris log mentah di awal.`);
  } catch (err) {
    console.error("Gagal membaca jumlah baris log awal:", err);
  }
}

// Aplikasi yang diabaikan dari tracking
const IGNORED_APPS = [
  "SearchHost",
  "StartMenuExperienceHost",
  "LockApp",
  "ShellExperienceHost",
  "ScreenClippingHost",
  "Microsoft.Notes",
  "ActionCenter",
];

// Format durasi detik ke format teks
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} detik`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let result = "";
  if (hours > 0) result += `${hours} jam `;
  if (minutes > 0) result += `${minutes} menit `;
  if (remainingSeconds > 0 && hours === 0) result += `${remainingSeconds} detik`;
  return result.trim();
}

// Menyimpan log aktivitas ke SQLite dan file JSON cadangan
function saveRawLog(activity) {
  // 1. Simpan langsung ke SQLite (Asinkron & zero CPU overhead)
  saveRawActivityDirectly(activity).catch((err) => {
    console.error("[DB Error] Gagal simpan aktivitas langsung ke SQLite:", err.message);
  });

  // 2. Simpan juga ke file JSON raw_logs.json untuk redundansi cadangan
  const logLine = JSON.stringify(activity) + "\n";
  try {
    fs.appendFileSync(RAW_LOG_FILE, logLine, "utf-8");
    console.log(`[Tersimpan] ${activity.category} -> ${activity.app} | ${activity.window_title.slice(0, 40)}`);
    rawLogCounter++;
  } catch (err) {
    console.error("Gagal menyimpan log cadangan:", err);
  }
}

// Update status realtime ke overlay UI
function updateOverlayStatus(category, app, duration, isIdle) {
  const data = {
    category,
    app,
    duration,
    is_idle: isIdle,
    updatedAt: Date.now(),
  };
  broadcastOverlayStatus(data);
}

// Inisialisasi GUI Overlay C# / PowerShell
function startOverlay() {
  const exePath = path.join(__dirname, "tools", "overlay", "overlay.exe");
  const csPath = path.join(__dirname, "tools", "overlay", "overlay.cs");

  if (fs.existsSync(csPath) && !fs.existsSync(exePath)) {
    console.log("[Overlay C#] Mengompilasi file overlay.cs menjadi overlay.exe...");
    const cscPath = "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe";
    try {
      const refs = [
        `"C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\PresentationFramework.dll"`,
        `"C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\PresentationCore.dll"`,
        `"C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\WPF\\WindowsBase.dll"`,
        `"System.dll"`,
        `"System.Core.dll"`,
        `"System.Xaml.dll"`,
      ].map((r) => `/r:${r}`).join(" ");

      execSync(`"${cscPath}" /target:winexe ${refs} /out:"${exePath}" "${csPath}"`);
      console.log("[Overlay C#] Kompilasi berhasil!");
    } catch (err) {
      console.error("[Overlay C#] Gagal mengompilasi C#. Menggunakan fallback PowerShell...", err.message);
    }
  }

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
      "-File", scriptPath,
    ]);
  }

  overlayProcess.stderr?.on("data", (data) => {
    console.error(`[Overlay Error]: ${data.toString()}`);
  });
  overlayProcess.on("error", (err) => {
    console.error("Gagal menjalankan overlay GUI:", err);
  });
}

// Loop Utama Pelacakan Window Aktif
async function trackActivity() {
  const window = await activeWindow();
  const now = Date.now();
  const idleTimeSeconds = getIdleTimeSeconds();

  let batasWaktuAFK = 60; // Default AFK 60 detik
  if (
    currentActivity &&
    (currentActivity.category === "NONTON" || currentActivity.category === "MUSIC")
  ) {
    batasWaktuAFK = 7200; // Toleransi hingga 2 jam untuk media
  }

  // 1. Deteksi User AFK / Idle
  if (idleTimeSeconds >= batasWaktuAFK) {
    statusAFK = "AFK";
    lastidleTime = idleTimeSeconds;
    if (currentActivity) {
      const exactEndMs = now - idleTimeSeconds * 1000;
      currentActivity.end = new Date(exactEndMs).toLocaleTimeString([], { hour12: false });
      currentActivity.duration = Math.floor((exactEndMs - currentActivity.startTimeMs) / 1000);
      if (currentActivity.duration > MIN_DURATION_SECONDS) {
        saveRawLog(currentActivity);
      }
      currentActivity = null;
    }
    updateOverlayStatus("IDLE / AFK", "Layar tidak aktif", 0, true);
    return;
  } else if (idleTimeSeconds === 0 && statusAFK === "AFK") {
    console.log("Kamu AFK selama:", formatDuration(lastidleTime));
    statusAFK = "ACTIVE";
    lastidleTime = 0;
  }

  if (now - lastTickTime > IDLE_THRESHOLD) {
    if (currentActivity) {
      currentActivity.end = new Date(lastTickTime).toLocaleTimeString([], { hour12: false });
      currentActivity.duration = Math.floor((lastTickTime - currentActivity.startTimeMs) / 1000);
      if (currentActivity.duration > 0) {
        saveRawLog(currentActivity);
      }
      currentActivity = null;
    }
  }
  lastTickTime = now;

  if (!window) return;

  const appName = window.owner.name;
  const windowTitle = window.title;

  if (IGNORED_APPS.some((ignored) => appName.includes(ignored))) {
    return;
  }

  // 2. Deteksi Perpindahan Window / Aplikasi
  if (
    !currentActivity ||
    currentActivity.app !== appName ||
    currentActivity.window_title !== windowTitle
  ) {
    if (currentActivity) {
      currentActivity.end = new Date(now).toLocaleTimeString();
      currentActivity.duration = Math.floor((now - currentActivity.startTimeMs) / 1000);
      if (currentActivity.duration > MIN_DURATION_SECONDS) {
        saveRawLog(currentActivity);
      } else {
        console.log(`[Abaikan] Aktivitas terlalu singkat (${currentActivity.duration}s): ${currentActivity.app}`);
      }
    }

    const isBrowser = isBrowserApp(appName);
    const cacheCategory = !isBrowser ? learnedCategoriesCache[appName] : null;
    const resolvedCategory = cacheCategory || getCategory(appName, windowTitle);
    const dateObj = new Date(now);

    currentActivity = {
      category: resolvedCategory,
      project_context: "Unknown",
      app: appName,
      window_title: windowTitle,
      day_of_week: dateObj.toLocaleDateString("id-ID", { weekday: "long" }),
      hours_of_day: dateObj.getHours(),
      start: new Date(now).toLocaleTimeString(),
      startTimeMs: now,
      end: null,
      duration: 0,
    };

    console.log(`[${currentActivity.start}] [ Aktif ] -> ${appName} : ${windowTitle}`);
  }

  // 3. Update overlay di setiap tick
  if (currentActivity) {
    const durationSeconds = Math.floor((now - currentActivity.startTimeMs) / 1000);
    updateOverlayStatus(currentActivity.category, currentActivity.app, durationSeconds, false);
  }
}

// Jalankan Loop
setInterval(trackActivity, 3000);

// Inisialisasi Servis Tambahan
const apiServer = startTrackingApiServer((newCache) => {
  learnedCategoriesCache = newCache;
});
startConsolidationScheduler();
startTcpServer(5006);
startOverlay();

// Penanganan Shutdown Bersih (Graceful Shutdown)
let isExiting = false;
process.on("SIGINT", () => {
  if (isExiting) return;
  isExiting = true;

  if (overlayProcess) {
    overlayProcess.kill();
  }
  console.log("\nMematikan program, menyimpan sisa aktivitas...");

  if (currentActivity) {
    const now = Date.now();
    currentActivity.end = new Date(now).toLocaleTimeString();
    currentActivity.duration = Math.floor((now - currentActivity.startTimeMs) / 1000);
    if (currentActivity.duration > MIN_DURATION_SECONDS) {
      saveRawLog(currentActivity);
    }
  }

  console.log("[Shutdown] Aktivitas berhasil disimpan ke SQLite. Tracker dimatikan dengan aman.");
  if (apiServer) {
    apiServer.close();
  }
  process.exit(0);
});
