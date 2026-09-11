import { toolBacaInformasi } from "../functions/personal/baca_informasi.js";
import { bacaSemuaJadwal } from "../services/jadwalService.js";

async function testMemory() {
  console.log("--- Uji Baca Memori Informasi ---");
  const info = await toolBacaInformasi.invoke({});
  console.log("Hasil toolBacaInformasi:\n", info);

  if (info.includes("Dania")) {
    console.log("✓ SUCCESS: Dania ditemukan di dalam memori!");
  } else {
    console.error("✗ FAILED: Dania TIDAK ditemukan di dalam memori!");
    process.exit(1);
  }

  console.log("\n--- Uji Baca Memori Jadwal ---");
  const jadwal = bacaSemuaJadwal(true);
  console.log(`Jumlah jadwal terbaca: ${jadwal.length}`);
  if (jadwal.length > 0) {
    console.log("✓ SUCCESS: Jadwal berhasil dibaca dari memory/jadwal.json!");
  } else {
    console.warn("⚠ WARNING: Jadwal kosong atau file jadwal.json kosong.");
  }
}

testMemory();
