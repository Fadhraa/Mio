import { maskText, unmaskText, getMaskMapping } from "../utils/privacyMasker.js";

async function testPrivacyMasker() {
  console.log("=== UJI PRIVACY MASKER DUA ARAH ===");
  const mapping = getMaskMapping();
  console.log("Kamus Pemetaan:", mapping);
  if (!mapping["Fadhra"] || !mapping["Dania"]) {
    console.error("✗ FAILED: Mapping Fadhra atau Dania tidak ditemukan!");
    process.exit(1);
  }
  const rawInput = "Halo Fadhra, apa kabar pacarmu Dania dan kucingmu Geko yang berwarna abu-abu?";
  const masked = maskText(rawInput);
  console.log("Masked Payload ke Cloud:", masked);
  if (masked.includes("Fadhra") || masked.includes("Dania") || masked.includes("Geko")) {
    console.error("✬ FAILED: Data sensitif masih bocor di masked text!");
    process.exit(1);
  }
  console.log("✄ SUCCESS: Semua data sensitif berhasil disensor dengan token placeholder.");
  const unmasked = unmaskText(masked);
  console.log("Unmasked Output Pengguna:", unmasked);
  if (unmasked !== rawInput) {
    console.error("✫ FAILED: Teks unmasked tidak cocok dengan teks awal!");
    process.exit(1);
  }
  console.log("✄ SUCCESS: Rekonstruksi data asli 100% identik tanpa kehilangan konteks!");
  process.exit(0);
}
testPrivacyMasker();
