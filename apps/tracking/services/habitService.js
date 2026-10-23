/**
 * habitService.js
 * Service untuk memfilter kebiasaan relevan (Context Projection) dan memperbarui habit.json (Reinforcement Loop).
 */

const path = require("path");
const fs = require("fs");

const HABIT_JSON_PATH = path.resolve(__dirname, "../../assistant/memory/habit.json");

// Menentukan kebiasaan yang relevan & melakukan minifikasi data (Projection)
function getRelevantHabitsContext(activeCategories = [], activeApps = []) {
  if (!fs.existsSync(HABIT_JSON_PATH)) return [];

  try {
    const rawData = fs.readFileSync(HABIT_JSON_PATH, "utf-8");
    const allHabits = JSON.parse(rawData);

    const searchKeywords = [
      ...activeCategories.map((c) => c.toLowerCase()),
      ...activeApps.map((a) => a.toLowerCase()),
    ];

    const matchedHabits = [];

    for (const [key, val] of Object.entries(allHabits)) {
      const habitKey = key.toLowerCase();
      const desc = (val.deskripsi || "").toLowerCase();
      const target = (val.target || "").toLowerCase();

      const isRelevant = searchKeywords.some((kw) => {
        if (!kw || kw.length < 3) return false;
        return habitKey.includes(kw) || desc.includes(kw) || target.includes(kw);
      });

      if (isRelevant) {
        matchedHabits.push({
          key: key,
          deskripsi: val.deskripsi,
          target: val.target || null,
        });
      }
    }

    return matchedHabits.slice(0, 5);
  } catch (error) {
    console.error("[Habit Context Error]:", error.message);
    return [];
  }
}

// Update memori kebiasaan di apps/assistant/memory/habit.json
function updateHabitMemory(aiResult) {
  if (!aiResult) return;
  const matchedKeys = aiResult.matched_habit_keys || [];
  const newHabits = aiResult.detected_new_habits || [];

  if (matchedKeys.length === 0 && newHabits.length === 0) return;

  try {
    let currentHabits = {};
    if (fs.existsSync(HABIT_JSON_PATH)) {
      currentHabits = JSON.parse(fs.readFileSync(HABIT_JSON_PATH, "utf-8"));
    }

    let isModified = false;
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. REINFORCE: Perbarui kebiasaan lama yang cocok
    for (const key of matchedKeys) {
      if (currentHabits[key]) {
        currentHabits[key].log = currentHabits[key].log || [];
        if (!currentHabits[key].log.includes(todayStr)) {
          currentHabits[key].log.push(todayStr);
          currentHabits[key].lastObservedAt = new Date().toISOString();
          isModified = true;
          console.log(`[Habit Memory] Kebiasaan diperkuat: "${key}" tercatat aktif hari ini.`);
        }
      }
    }

    // 2. CREATE NEW: Tambahkan kebiasaan baru yang terdeteksi
    for (const h of newHabits) {
      if (!h.key || !h.deskripsi) continue;
      if (!currentHabits[h.key]) {
        currentHabits[h.key] = {
          deskripsi: h.deskripsi,
          target: h.target || null,
          log: [todayStr],
          createdAt: new Date().toISOString(),
          autoLearned: true,
        };
        isModified = true;
        console.log(`[Habit Memory] Kebiasaan baru dipelajari: "${h.key}"`);
      }
    }

    if (isModified) {
      fs.writeFileSync(HABIT_JSON_PATH, JSON.stringify(currentHabits, null, 2), "utf-8");
      console.log("[Habit Memory] File habit.json berhasil diperbarui secara aman.");
    }
  } catch (err) {
    console.error("[Habit Memory Error]:", err.message);
  }
}

module.exports = {
  getRelevantHabitsContext,
  updateHabitMemory,
  HABIT_JSON_PATH,
};
