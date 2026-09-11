import "./paths.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { jalankanMio } from "./agent.js";
import { ambilJadwal } from "./controllers/jadwalController.js";
import { getBriefingDashboard } from "./services/briefingService.js";
import { requireApiKey } from "./middlewares/authMiddleware.js";
import { USER_NAME } from "./paths.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi model Gemini Vision secara malas (lazy loading)
let visionModel = null;
function dapatkanVisionModel() {
  if (!visionModel) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di file .env");
    }
    visionModel = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      modelName: "gemini3.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.2,
    });
  }
  return visionModel;
}

// Fungsi untuk menganalisis gambar base64 menggunakan Gemini 1.5 Flash
async function analisisGambarDenganGemini(base64DataUrl) {
  const model = dapatkanVisionModel();
  const pesanGambar = new HumanMessage({
    content: [
      {
        type: "text",
        text: "Jelaskan gambar ini secara detail, terperinci, dan jelas dalam Bahasa Indonesia. Deskripsikan apa yang terjadi, teks apa yang tertulis (jika ada), elemen UI, atau objek yang terlihat agar asisten AI lain dapat memahaminya sebagai konteks percakapan.",
      },
      {
        type: "image_url",
        image_url: {
          url: base64DataUrl,
        },
      },
    ],
  });

  const response = await model.invoke([pesanGambar]);
  return response.content;
}

// Fungsi pembungkus untuk menjalankan web server
export function mulaiServer(port = 3000) {
  const app = express();
  const serverPort = process.env.PORT || port;

  // 1. Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. CORS Policy: Membatasi origin yang boleh mengakses API
  const defaultOrigins =
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000";
  const allowedOrigins = (process.env.CORS_ORIGIN || defaultOrigins)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Izinkan request tanpa origin (seperti daemon tracker, satellite desktop, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        return callback(
          new Error(
            `CORS Policy: Origin ${origin} tidak diizinkan oleh sistem keamanan Mio.`,
          ),
        );
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    }),
  );

  // 3. Middleware parsing JSON
  app.use(express.json({ limit: "20mb" }));

  // 4. Menyajikan file statis front-end (terbuka agar browser dapat memuat bundle web)
  const webFolder = path.join(__dirname, "..", "web", "dist");
  app.use(express.static(webFolder));

  // 5. Endpoint Verifikasi Autentikasi API Key
  app.get("/api/auth/verify", requireApiKey, (req, res) => {
    res.json({
      ok: true,
      message: "API Key valid dan terautentikasi.",
      timestamp: new Date().toISOString(),
    });
  });

  // 6. Kunci Seluruh Route API dengan Middleware Keamanan API Key
  app.use("/api", requireApiKey);

  // API Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    const { message, image } = req.body;

    if (!message && !image) {
      return res
        .status(400)
        .json({ error: "Pesan atau gambar tidak boleh kosong." });
    }

    let inputUntukMio = message || "";
    let visualDescription = "";

    try {
      // Jika ada kiriman gambar, analisis dulu dengan Gemini Flash
      if (image) {
        console.log("📸 Menganalisis gambar menggunakan Gemini 3.5 Flash...");
        visualDescription = await analisisGambarDenganGemini(image);
        console.log("🔍 Hasil Analisis Gambar:", visualDescription);

        // Sisipkan deskripsi visual ini sebagai konteks tambahan bagi Agen Utama Mio
        inputUntukMio = `[Gambar yang diunggah/di-paste oleh ${USER_NAME}]:\n${visualDescription}\n\n[Pesan/Pertanyaan ${USER_NAME}]:\n${message || "Jelaskan gambar tersebut."}`;
      }

      // Jalankan Mio AI (dari agent.js)
      console.log(`🤖 Mio sedang berpikir memproses request...`);
      const jawabanMio = await jalankanMio(
        inputUntukMio,
        message || "mengunggah gambar",
      );

      res.json({
        reply: jawabanMio,
        analysis: visualDescription || null,
      });
    } catch (error) {
      console.error("[ERROR API CHAT]:", error);
      res
        .status(500)
        .json({ error: error.message || "Terjadi kesalahan sistem internal." });
    }
  });

  app.get("/api/jadwal", ambilJadwal);

  app.get("/api/dashboard/briefing", async (req, res) => {
    try {
      const isFresh = req.query.fresh === "true";
      const hasil = await getBriefingDashboard(USER_NAME, isFresh);
      res.json(hasil);
    } catch (err) {
      console.error("Gagal mengambil briefing:", err);
      res.status(500).json({ error: "Gagal memproses briefing AI" });
    }
  });


  // Mulai mendengarkan request
  app.listen(serverPort, () => {
    console.log(`\n======================================================`);
    console.log(
      `🔒 Mio Web Server aktif (API Key Secured): http://localhost:${serverPort}`,
    );
    console.log(`======================================================\n`);
  });
}
