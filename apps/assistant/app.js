import "dotenv/config";
import readline from "readline";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { jalankanMio } from "./agent.js";
import { mulaiServer } from "./server.js";
import { koneksiKeWA } from "./services/waService.js";

function mulaiBackgroundServices() {
  // 1. Inisialisasi Deteksi Suara (telinga.py)
  const rootVenvPython = path.join(__dirname, "..", "..", ".venv", "Scripts", "python.exe");
  const localVenvPython = path.join(__dirname, "venv", "Scripts", "python.exe");
  const pythonCmd = fs.existsSync(rootVenvPython)
    ? rootVenvPython
    : fs.existsSync(localVenvPython)
      ? localVenvPython
      : "python";

  try {
    const telinga = spawn(pythonCmd, ["telinga.py"], { cwd: __dirname });
    telinga.stdout.on("data", async (data) => {
      const barisData = data.toString().split("\n");
      for (let hasilSuara of barisData) {
        hasilSuara = hasilSuara.trim();
        if (!hasilSuara) continue;

        if (hasilSuara === "READY") {
          console.log("🎤 [Audio Service] Telinga lokal siap mendengarkan suara.");
          continue;
        }

        if (hasilSuara.startsWith("DEBUG:")) {
          console.log(`[Audio Debug]: ${hasilSuara}`);
          continue;
        }

        if (hasilSuara.startsWith("PERINTAH:")) {
          const perintahAsli = hasilSuara.replace("PERINTAH:", "").trim();
          console.log(`🎤 [Audio Perintah Diterima]: "${perintahAsli}"`);
          try {
            const jawaban = await jalankanMio(perintahAsli, "perintah suara langsung");
            console.log(`🤖 [Mio Audio Response]: ${jawaban}`);
          } catch (err) {
            console.error("[Audio Processing Error]:", err.message);
          }
          continue;
        }
      }
    });

    telinga.stderr.on("data", (data) => {
      // Abaikan log biasa dari ALSA/PyAudio jika bukan fatal
      const errStr = data.toString();
      if (!errStr.includes("ALSA") && !errStr.includes("jack")) {
        console.error(`[Audio Error]: ${errStr}`);
      }
    });
  } catch (err) {
    console.warn("[Audio Service Warning]: Tidak dapat memulai modul audio:", err.message);
  }

  // 2. Inisialisasi Desktop Activity Tracker
  const pelacakDir = path.join(__dirname, "..", "tracking");
  if (fs.existsSync(pelacakDir)) {
    const pelacak = spawn("node", ["track.js"], { cwd: pelacakDir });
    pelacak.on("error", (err) => {
      console.warn("[Pelacak Activity Warning]: Tidak dapat memulai tracker:", err.message);
    });
  }
}

async function main() {
  try {
    const port = process.env.PORT || 3000;
    console.log("⏳ Memulai Web Server Mio Core...");
    mulaiServer(port);

    console.log("⏳ Menghubungkan ke WhatsApp Service...");
    await koneksiKeWA();

    console.log("⏳ Memulai Background Services (Audio & Tracker)...");
    mulaiBackgroundServices();

    console.log("\n======================================================");
    console.log("✅ Mio Backend Daemon Berjalan Sempurna!");
    console.log(`   Web Dashboard : http://localhost:5173 (via npm run dev)`);
    console.log(`   API Endpoint  : http://localhost:${port}/api`);
    console.log(`   Terminal Chat : Buka terminal baru dan ketik "npm run cli"`);
    console.log("======================================================\n");
  } catch (error) {
    console.error("[ERROR BOOTSTRAP SYSTEM]:", error);
  }
}
main();

