import "dotenv/config";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat konfigurasi .env jika belum termuat
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const dotenv = await import("dotenv");
  dotenv.config({ path: envPath });
}

const SERVER_URL = process.env.MIO_SERVER_URL || "http://localhost:3000";
const API_KEY = process.env.MIO_API_KEY;

async function cekKoneksiServer() {
  if (!API_KEY) {
    console.error("[ERROR] MIO_API_KEY tidak ditemukan di environment (.env).");
    console.error("Harap atur MIO_API_KEY terlebih dahulu sebelum menggunakan CLI.\n");
    process.exit(1);
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (res.status === 401) {
      console.error(`[ERROR 401] Akses ditolak: MIO_API_KEY tidak valid untuk server di ${SERVER_URL}.`);
      process.exit(1);
    }

    if (!res.ok) {
      console.error(`[ERROR] Server merespons dengan status ${res.status}.`);
      process.exit(1);
    }

    return true;
  } catch (err) {
    console.error(`[ERROR KONEKSI] Tidak dapat tersambung ke Mio Server di ${SERVER_URL}`);
    console.error("Pastikan server Mio sudah aktif di terminal lain (jalankan: npm run dev).\n");
    process.exit(1);
  }
}

async function kirimPesanKeApi(pesan) {
  const res = await fetch(`${SERVER_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ message: pesan }),
  });

  const data = await res.json();
  if (res.status === 401) {
    throw new Error(data.message || "Akses ditolak (Unauthorized).");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply;
}

async function main() {
  await cekKoneksiServer();

  console.clear();
  console.log("======================================================");
  console.log("           Mio AI - Interactive CLI Client            ");
  console.log(` Target Server : ${SERVER_URL}`);
  console.log(" Status        : Terautentikasi (API Key Valid)");
  console.log(" Perintah      : /exit (keluar), /clear (bersihkan layar)");
  console.log("======================================================\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function promptUser() {
    rl.question("Anda > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        return promptUser();
      }

      if (trimmed === "/exit" || trimmed === "/quit" || trimmed.toLowerCase() === "exit") {
        console.log("\nSampai jumpa!");
        rl.close();
        process.exit(0);
      }

      if (trimmed === "/clear") {
        console.clear();
        return promptUser();
      }

      if (trimmed === "/help") {
        console.log("\nDaftar Perintah:");
        console.log("  /exit  : Keluar dari antarmuka CLI");
        console.log("  /clear : Membersihkan tampilan layar terminal");
        console.log("  /help  : Menampilkan bantuan ini\n");
        return promptUser();
      }

      // Tampilkan indikator menunggu
      process.stdout.write("Mio  > Sedang memproses...");

      try {
        const balasan = await kirimPesanKeApi(trimmed);

        // Hapus teks indikator dan tampilkan respons
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(`Mio  > ${balasan}\n`);
      } catch (err) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.error(`[Error] Gagal menerima balasan: ${err.message}\n`);
      }

      promptUser();
    });
  }

  promptUser();
}

main();
