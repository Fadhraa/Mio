/**
 * geminiService.js
 * Service untuk berkomunikasi dengan Google Gemini 3.5 Flash API guna menghasilkan refleksi harian.
 */

const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
} else {
  require("dotenv").config();
}

const { maskText, unmaskText } = require("../helpers/privacyMasker");
const { getRelevantHabitsContext } = require("./habitService");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateDailyReflection(aggregatedData) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di file .env");
  }

  // 1. Ambil kebiasaan yang relevan dengan konteks hari ini
  const activeCats = (aggregatedData.categories || []).map((c) => c.category);
  const activeApps = (aggregatedData.top_apps || []).map((a) => a.app);
  const relevantHabits = getRelevantHabitsContext(activeCats, activeApps);

  // 2. Siapkan payload yang disensor (PII Masking)
  const promptPayload = maskText(JSON.stringify(aggregatedData, null, 2));
  const habitsPayload = maskText(JSON.stringify(relevantHabits, null, 2));

  const systemInstruction = `Anda adalah asisten AI personal milik <USER>.
Tugas Anda adalah membaca ringkasan statistik aktivitas komputer harian <USER>, lalu menghasilkan refleksi harian dan memperbarui profil kebiasaan.

Daftar Kebiasaan Relevan Saat Ini:
${habitsPayload}

Format keluaran WAJIB berupa JSON murni:
{
  "category": "KATEGORI_UTAMA",
  "summary": "Narasi refleksi dalam 2-3 kalimat santai dan suportif",
  "matched_habit_keys": ["key_yang_cocok"],
  "detected_new_habits": [
    {
      "key": "nama_kebiasaan_baru_snake_case",
      "deskripsi": "Deskripsi singkat",
      "target": "Aplikasi atau website target"
    }
  ]
}

Aturan:
1. Jika aktivitas hari ini merupakan pola yang SUDAH ADA di "Daftar Kebiasaan Relevan", masukkan namanya ke "matched_habit_keys". JANGAN buat duplikat di "detected_new_habits"!
2. Hanya buat entri di "detected_new_habits" jika aktivitas hari ini benar-benar pola baru berdurasi signifikan (> 30 menit). Jika tidak ada, buat array kosong [].`;

  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-flash-latest"
  ];

  let response = null;
  let lastErrText = "";

  for (const modelName of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: systemInstruction + "\n\nData Statistik Aktivitas Hari Ini:\n" + promptPayload,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        break; // Berhasil
      } else {
        lastErrText = await response.text();
        // Jika 503 (high demand), coba model berikutnya
        if (response.status === 503) {
          console.warn(`[Gemini Service] Model ${modelName} sedang 503 (high demand), mencoba fallback...`);
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          throw new Error(`Gemini API Error (${response.status}): ${lastErrText}`);
        }
      }
    } catch (fetchErr) {
      lastErrText = fetchErr.message;
    }
  }

  if (!response || !response.ok) {
    throw new Error(`Gemini API Error: ${lastErrText}`);
  }

  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  let parsed = {};
  try {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    const jsonStr =
      firstBrace !== -1 && lastBrace !== -1
        ? rawText.substring(firstBrace, lastBrace + 1)
        : rawText.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[JSON Parse Error] Raw text was:", rawText);
    parsed = {
      category: aggregatedData.categories[0]?.category || "CODING",
      summary: rawText.replace(/[\{\}\[\]"]/g, "").trim().slice(0, 300),
      matched_habit_keys: [],
      detected_new_habits: [],
    };
  }

  // Unmask teks kembali ke data lokal
  parsed.summary = unmaskText(parsed.summary || "");
  if (Array.isArray(parsed.detected_new_habits)) {
    parsed.detected_new_habits = parsed.detected_new_habits.map((h) => ({
      key: (h.key || "").toLowerCase().replace(/\s+/g, "_"),
      deskripsi: unmaskText(h.deskripsi || ""),
      target: unmaskText(h.target || null),
    }));
  }

  return parsed;
}

module.exports = {
  generateDailyReflection,
};
