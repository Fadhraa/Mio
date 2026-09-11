const { OpenAI } = require("openai");
const path = require("path");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});
async function generateText() {
  const response = await openai.chat.completions.create({
    model: "google/gemma-2-2b-it",
    messages: [
      {
        role: "user",
        content: "selamat pagi, siapa kamu?",
      },
    ],
  });
  console.log(response.choices[0].message.content);
}
function extractMainJson(text) {
  // 1. Coba cari markdown block first
  const markdownMatch = text.match(/```(?:json)?\n([\s\S]*?)```/);
  if (markdownMatch && markdownMatch[1]) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch (e) {
      // jika gagal, lanjut ke fallback di bawah
    }
  }

  // 2. Cari kata kunci "sessions" untuk menemukan objek utama
  const sessionsIndex = text.indexOf('"sessions"');
  if (sessionsIndex === -1) {
    // Fallback terakhir: jika tidak ada "sessions", cari brace pertama dan terakhir
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1).trim());
    }
    throw new Error("Tidak menemukan objek JSON");
  }

  // Cari '{' pembuka objek utama (brace pertama sebelum "sessions")
  let openBraceIndex = -1;
  for (let i = sessionsIndex; i >= 0; i--) {
    if (text[i] === "{") {
      openBraceIndex = i;
      break;
    }
  }

  if (openBraceIndex === -1) {
    throw new Error("Tidak menemukan '{' pembuka untuk objek utama");
  }

  // Scan maju dari openBraceIndex untuk mencari '}' penutup yang sejajar
  let braceCount = 0;
  let closeBraceIndex = -1;
  for (let i = openBraceIndex; i < text.length; i++) {
    if (text[i] === "{") {
      braceCount++;
    } else if (text[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        closeBraceIndex = i;
        break;
      }
    }
  }

  if (closeBraceIndex === -1) {
    throw new Error("Tidak menemukan '}' penutup yang sejajar");
  }

  const jsonString = text.substring(openBraceIndex, closeBraceIndex + 1);
  return JSON.parse(jsonString.trim());
}

async function summarizeActivities(activitiesArray) {
  // 1. Ubah array aktivitas menjadi list teks biasa yang mudah dibaca AI
  const activityText = activitiesArray
    .map(
      (a) =>
        `- Kategori: ${a.category} | Hari ${a.day_of_week} Jam ${a.hour_of_day} (${a.start}) | [${a.duration} detik] | App: ${a.app} | Title: ${a.window_title}`,
    )
    .join("\n");
  // 2. Buat instruksi (Prompt) untuk Batch Processing

  const systemPrompt = `Anda adalah asisten data logger milik Fadhra, seorang programmer.
    Tugas Anda adalah merangkum log aktivitas layar menjadi objek JSON.
    Aturan Wajib:
    1. PENGGABUNGAN (PENTING!): Jangan buat 1 objek JSON untuk tiap 1 baris log. Anda HARUS menggabungkan log-log yang memiliki konteks/aplikasi yang sama menjadi SATU sesi besar.
    2. Distraksi: Abaikan log yang sangat singkat jika ada di sela-sela aktivitas utama.
    3. KATEGORI (SANGAT PENTING!):
       - Jika kategori di log input adalah kategori spesifik (seperti "CODING", "COMMUNICATION", "RESEARCH_BROWSING"), Anda WAJIB menggunakan kategori tersebut.
       - DILARANG KERAS menghasilkan kategori "LAINNYA" pada objek JSON output! Jika log input berlabel "LAINNYA", Anda WAJIB mengubahnya ke kategori yang paling cocok dari daftar ini: "CODING", "ENTERTAINMENT", "LEARNING", "BROWSING_CASUAL", "SOCIAL", "WORK_OTHER", "GAMING", "NONTON".
    4. GAYA BAHASA: Tulis "summary" dengan gaya bercerita yang natural, bervariasi, dan luwes seperti asisten manusia. DILARANG KERAS menggunakan template kaku seperti "Aktivitas utama pada pukul X adalah Y". Ceritakan saja apa yang dia kerjakan secara keseluruhan di sesi itu.
    5. BELAJAR KATEGORI BARU (learned_mappings):
       Jika Anda mengubah kategori sebuah aplikasi yang tadinya "LAINNYA" menjadi kategori lain (misalnya "NTE Launcher" diubah menjadi "GAMING"), Anda WAJIB mendaftarkannya di "learned_mappings" agar aplikasi bisa mengingatnya.
       Format: {"app": "Nama Aplikasi", "category": "Kategori Baru"}
    6. Output WAJIB berupa objek JSON mentah tanpa markdown.
    
    Struktur JSON yang diharapkan:
    {
      "sessions": [
        {
          "category": "Kategori",
          "day_of_week": "Hari",
          "hour_of_day": 14,
          "start_time": "14:10:05",
          "total_duration_seconds": 120,
          "apps_used": ["App1"],
          "summary": "Fadhra fokus ngoding..."
        }
      ],
      "learned_mappings": []
    }`;

  const userPrompt = `Ini adalah log layar komputarku yang berurutan waktu:\n${activityText}`;
  try {
    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      top_p: 1,
      max_tokens: 2048,
      stream: false,
    });
    // Ambil string hasil balasan AI
    const aiResponseText = completion.choices[0].message.content;

    console.log("\n=== RESPOND RAW DARI AI ===");
    console.log(aiResponseText);
    console.log("===========================\n");

    // Ekstrak dan parse objek utama menggunakan helper baru
    return extractMainJson(aiResponseText);
  } catch (error) {
    console.error("Gagal menyimpulkan AI:", error);
    throw error;
  }
}
module.exports = {
  summarizeActivities,
  generateText,
};
