const KEYWORDS = {
  // --- PRIORITAS TINGGI (Konteks Spesifik) ---
  LEARNING: [
    "tutorial",
    "course",
    "belajar",
    "class",
    "udemy",
    "dicoding",
    "w3schools",
    "how to",
  ],
  MUSIC: [
    "music",
    "lagu",
    "spotify",
    "mp3",
    "lirik",
    "lyrics",
    "cover",
    "official video",
    "audio",
  ],
  NONTON: [
    "netflix",
    "otakudesu",
    "movie",
    "anime",
    "youtube",
    "cinema",
    "nonton",
  ],

  // --- PRIORITAS MENENGAH (Aplikasi Khusus) ---
  CODING: [
    "antigravity",
    "visual studio",
    "code",
    "terminal",
    "powershell",
    "git",
    "cursor",
  ],
  GAMING: ["wuthering waves", "valorant", "steam", "riot", "epic games"],
  ACADEMIC: [
    "word",
    "excel",
    "powerpoint",
    "pdf",
    "acrobat",
    "ethol",
    "Enterprise Technology Hybrid Online Learning",
  ],
  COMMUNICATION: ["whatsapp", "discord", "telegram", "zoom", "teams", "meet"],

  // --- PRIORITAS RENDAH (Browser Umum) ---
  RESEARCH_BROWSING: [
    "edge",
    "chrome",
    "firefox",
    "brave",
    "stackoverflow",
    "chatgpt",
  ],
};

function getCategory(appName, title) {
  const textToSearch = (appName + " " + title).toLowerCase();

  for (const category in KEYWORDS) {
    const kataKunciArray = KEYWORDS[category];

    // Cek apakah ada salah satu kata kunci yang cocok di dalam teks
    for (const kata of kataKunciArray) {
      if (textToSearch.includes(kata.toLowerCase())) {
        return category; // Langsung kembalikan nama kategorinya
      }
    }
  }

  return "LAINNYA";
}

module.exports = { getCategory };
