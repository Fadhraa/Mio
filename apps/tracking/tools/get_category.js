/**
 * get_category.js
 * Classifier Aktivitas Cerdas & Hierarkis:
 * 1. Memisahkan logika Browser vs Standalone App.
 * 2. Deteksi akurat YouTube Music vs Nonton/Video vs Edukasi.
 * 3. Deteksi akurat GitHub, StackOverflow, Web Dev localhost di Browser.
 * 4. Nol overhead latensi (0ms regex matching deterministik).
 */

const BROWSER_PROCESS_NAMES = [
  "msedge",
  "microsoft edge",
  "chrome",
  "google chrome",
  "brave",
  "firefox",
  "opera",
  "opera gx",
  "vivaldi",
  "safari"
];

// Helper: cek apakah appName adalah browser
function isBrowserApp(appName) {
  if (!appName) return false;
  const clean = appName.toLowerCase();
  return BROWSER_PROCESS_NAMES.some((b) => clean.includes(b));
}

// Pola kata kunci khusus untuk tab browser
function classifyBrowserTab(title) {
  const t = (title || "").toLowerCase();

  // 1. CODING & DEVELOPMENT DI BROWSER
  if (
    t.includes("github") ||
    t.includes("gitlab") ||
    t.includes("stackoverflow") ||
    t.includes("stack overflow") ||
    t.includes("stack exchange") ||
    t.includes("localhost:") ||
    t.includes("127.0.0.1:") ||
    t.includes("antigravity") ||
    t.includes("codesandbox") ||
    t.includes("codepen") ||
    t.includes("replit") ||
    t.includes("npmjs.com") ||
    t.includes("developer.mozilla.org") ||
    t.includes("mdn web docs") ||
    t.includes("w3schools") ||
    t.includes("regex101") ||
    t.includes("json crack") ||
    t.includes("devdocs")
  ) {
    return "CODING";
  }

  // 2. YOUTUBE & AUDIO/MUSIC STREAMING
  if (t.includes("music.youtube") || t.includes("spotify") || t.includes("soundcloud")) {
    return "MUSIC";
  }

  if (t.includes("youtube")) {
    // Bedakan: Video Musik vs Belajar/Tutorial vs Nonton Santai
    const isMusicKeyword = [
      "music",
      "lagu",
      "song",
      "lirik",
      "lyrics",
      "cover",
      "official video",
      "official audio",
      "music video",
      "audio",
      "lofi",
      "lo-fi",
      "ost",
      "soundtrack",
      "remix",
      "feat.",
      "ft.",
      "album",
      "full album",
      "radio - beats",
      "audio visualizer",
      "mv",
      "m/v"
    ].some((k) => t.includes(k));

    // Pola format lagu umum: "Artis - Judul" (contoh: "Radwimps - Sparkle", "Coldplay - Yellow")
    const hasArtistTrackPattern = /^[^-]+ - [^-]+ - youtube/i.test(title.trim());

    if (isMusicKeyword || hasArtistTrackPattern) {
      return "MUSIC";
    }

    const isLearningKeyword = [
      "tutorial",
      "course",
      "belajar",
      "class",
      "kuliah",
      "how to",
      "guide",
      "lecture",
      "penjelasan",
      "dasar-dasar",
      "pemrograman",
      "coding"
    ].some((k) => t.includes(k));

    if (isLearningKeyword) {
      return "LEARNING";
    }

    return "NONTON";
  }

  // 3. STREAMING & NONTON LAINNYA
  if (
    t.includes("netflix") ||
    t.includes("otakudesu") ||
    t.includes("samehadaku") ||
    t.includes("bilibili") ||
    t.includes("bstation") ||
    t.includes("disney+") ||
    t.includes("prime video") ||
    t.includes("crunchyroll") ||
    t.includes("anime") ||
    t.includes("cinema") ||
    t.includes("lk21")
  ) {
    return "NONTON";
  }

  // 4. COMMUNICATION & SOCIAL DI BROWSER
  if (
    t.includes("whatsapp") ||
    t.includes("discord") ||
    t.includes("telegram") ||
    t.includes("google meet") ||
    t.includes("meet.google") ||
    t.includes("zoom") ||
    t.includes("teams.microsoft") ||
    t.includes("slack")
  ) {
    return "COMMUNICATION";
  }

  if (
    t.includes("twitter") ||
    t.includes("x.com") ||
    t.includes("instagram") ||
    t.includes("reddit") ||
    t.includes("facebook") ||
    t.includes("tiktok")
  ) {
    return "SOCIAL";
  }

  // 5. ACADEMIC & ONLINE LEARNING
  if (
    t.includes("ethol") ||
    t.includes("enterprise technology hybrid online learning") ||
    t.includes("classroom.google") ||
    t.includes("google docs") ||
    t.includes("google sheets") ||
    t.includes("google slides") ||
    t.includes("overleaf") ||
    t.includes("dicoding") ||
    t.includes("udemy") ||
    t.includes("coursera") ||
    t.includes("edx") ||
    t.includes("scholar.google")
  ) {
    return "ACADEMIC";
  }

  // 6. DESIGN TOOL DI BROWSER
  if (t.includes("canva") || t.includes("figma") || t.includes("photopea")) {
    return "DESIGN";
  }

  // Default browser: Riset & Browsing Web
  return "RESEARCH_BROWSING";
}

// Standalone Desktop Applications (Non-Browser)
const DESKTOP_KEYWORDS = {
  CODING: [
    "antigravity",
    "visual studio",
    "code",
    "cursor",
    "terminal",
    "powershell",
    "cmd.exe",
    "git",
    "sublime",
    "intellij",
    "pycharm",
    "webstorm",
    "phpstorm",
    "android studio",
    "neovim",
    "vim"
  ],
  MUSIC: [
    "spotify",
    "foobar2000",
    "musicbee",
    "itunes",
    "winamp",
    "vlc"
  ],
  GAMING: [
    "wuthering waves",
    "valorant",
    "steam",
    "riot",
    "epic games",
    "genshin",
    "star rail",
    "minecraft",
    "roblox",
    "nte launcher"
  ],
  ACADEMIC: [
    "word",
    "excel",
    "powerpoint",
    "acrobat",
    "foxit",
    "notion",
    "obsidian",
    "onenote"
  ],
  COMMUNICATION: [
    "whatsapp",
    "discord",
    "telegram",
    "zoom",
    "teams",
    "slack",
    "skype"
  ],
  DESIGN: [
    "figma",
    "canva",
    "photoshop",
    "illustrator",
    "premiere",
    "after effects",
    "blender"
  ],
  UTILITIES: [
    "task manager",
    "taskmgr",
    "settings",
    "control panel",
    "windows features",
    "regedit"
  ]
};

function classifyDesktopApp(appName, windowTitle) {
  const combined = (appName + " " + windowTitle).toLowerCase();

  for (const category in DESKTOP_KEYWORDS) {
    const keywords = DESKTOP_KEYWORDS[category];
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        return category;
      }
    }
  }

  return "LAINNYA";
}

/**
 * Entry point utama klasifikasi aktivitas
 * @param {string} appName - Nama proses aplikasi (misal: "msedge", "Antigravity IDE")
 * @param {string} windowTitle - Judul window aktif
 * @returns {string} Nama Kategori
 */
function getCategory(appName, windowTitle) {
  const safeApp = (appName || "").trim();
  const safeTitle = (windowTitle || "").trim();

  // 1. Jika aplikasi adalah browser, fokuskan deteksi pada judul halaman web
  if (isBrowserApp(safeApp)) {
    return classifyBrowserTab(safeTitle);
  }

  // 2. Jika aplikasi standalone, gunakan pencocokan nama proses & judul window
  return classifyDesktopApp(safeApp, safeTitle);
}

module.exports = {
  getCategory,
  isBrowserApp,
  classifyBrowserTab,
  classifyDesktopApp
};
