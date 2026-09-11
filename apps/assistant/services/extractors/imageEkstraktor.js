import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { cariVaultByHash } from "../vaultService.js";
import { logWA } from "../waLogger.js";
import { STORAGE_DIR } from "../../paths.js";

const MEDIA_DIR = path.join(STORAGE_DIR, "media");


let visionModel = null;

function dapatVisionModel() {
  if (!visionModel) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY tidak tersedia");
    }
    visionModel = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      modelName: "gemini-3.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.2,
    });
  }
  return visionModel;
}
export async function prosesEkstraksiGambar(pesanWa, key) {
  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }
    // 1. Unduh media buffer gambar dari WhatsApp
    const buffer = await downloadMediaMessage(pesanWa, "buffer", {});

    // 2. Hitung SHA-256 Hash dari byte biner file gambar fisik
    const binaryHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 3. Pre-flight Check: Cek apakah Hash Biner Gambar sudah pernah disimpan di Vault (SQLite O(1) query)
    const itemLama = await cariVaultByHash(binaryHash);

    if (itemLama) {
      logWA.info(
        `⚡ [INSTANT BINARY DUP CHECK]: File foto fisik identik ditemukan di Vault!`,
      );
      return {
        isPreCheckedDuplicate: true,
        canonical_hash: binaryHash,
        existingItem: itemLama,
      };
    }

    // 4. Jika Foto Baru: Simpan file fisik ke storage/media/
    const timeStamp = Date.now();
    const namaFile = `vlt_img_${timeStamp}_${key.id}.jpg`;
    const pathFileLokal = path.join(MEDIA_DIR, namaFile);
    fs.writeFileSync(pathFileLokal, buffer);
    logWA.info(`📁 Gambar disimpan ke lokal: ${pathFileLokal}`);

    const base64Data = buffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;

    // 5. Olah deskripsi & OCR via Gemini Vision
    const model = dapatVisionModel();
    const promptVision = `Analisis gambar/screenshot ini dan berikan keluaran format JSON terstruktur persis seperti berikut (tanpa blok markdown):
{
  "judul": "Judul ringkas yang menggambarkan isi gambar (misal: 'Judul Lagu: Nanti - Fredy' atau 'Grafik Osiloskop')",
  "kategori": "Pilih salah satu paling sesuai: 'musik_lagu' | 'praktikum' | 'tangkapan_layar' | 'poster_event' | 'catatan_akademik' | 'referensi'",
  "ringkasan": "Hasil OCR teks penting yang terlihat dan penjelasan ringkas gambar dalam Bahasa Indonesia.",
  "tags": ["tag1", "tag2"]
}`;

    const pesanGambar = new HumanMessage({
      content: [
        {
          type: "text",
          text: promptVision,
        },
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
      ],
    });
    const response = await model.invoke([pesanGambar]);

    let dataAI = {};
    try {
      const jsonClean = response.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      dataAI = JSON.parse(jsonClean);
    } catch (e) {
      dataAI = {
        judul: "Tangkapan Gambar",
        kategori: "tangkapan_layar",
        ringkasan: response.content,
        tags: ["gambar"],
      };
    }

    return {
      tipe: "gambar",
      judul: dataAI.judul || "Tangkapan Gambar",
      kategori: dataAI.kategori || "tangkapan_layar",
      ringkasan: dataAI.ringkasan || response.content,
      tags: dataAI.tags || ["gambar"],
      canonical_hash: binaryHash, // Sertakan Hash Biner File Fisik
      file_path: pathFileLokal,
      file_name: namaFile,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    logWA.error("[ERROR IMAGE EXTRACTOR]:", error);
    return null;
  }
}
