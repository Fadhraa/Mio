import fs from "fs";
import path from "path";
import { LOGS_DIR } from "../paths.js";

const LOG_DIR = LOGS_DIR;
const LOG_FILE = path.join(LOG_DIR, "wa_service.log");


/**
 * Mencatat log aktivitas WhatsApp Service secara bersih ke file logs/wa_service.log
 * Mengisolasi log background daemon dari antarmuka CLI terminal Mio
 */
export function logWA(pesan, data = "", level = "INFO") {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const dataStr = data
      ? typeof data === "object"
        ? JSON.stringify(data)
        : String(data)
      : "";
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${pesan} ${dataStr}\n`;

    fs.appendFileSync(LOG_FILE, logLine, "utf-8");
  } catch (err) {
    console.error("[ERROR WRITE WA LOG]:", err);
  }
}

logWA.info = (pesan, data) => logWA(pesan, data, "INFO");
logWA.warn = (pesan, data) => logWA(pesan, data, "WARN");
logWA.error = (pesan, data) => logWA(pesan, data, "ERROR");

