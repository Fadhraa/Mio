import fs from "fs";
import path from "path";
import { logWA } from "./waLogger.js";
import { WA_SYNC_PATH } from "../paths.js";

const SYNC_FILE = WA_SYNC_PATH;
const BATAS_MAKSIMAL_HARI = 7 * 24 * 60 * 60;


export function getLastSyncTime() {
  try {
    if (fs.existsSync(SYNC_FILE)) {
      const data = JSON.parse(fs.readFileSync(SYNC_FILE), "utf-8");
      const detikSekarang = Math.floor(Date.now() / 1000);
      const batasTujuhHari = detikSekarang - BATAS_MAKSIMAL_HARI;
      if (data.last_synced_timestamp < batasTujuhHari) {
        logWA.warn("Laptop mati lebih dari 7 hari. Membatalkan sync offline WA.");
        return batasTujuhHari;
      }
      return data.last_synced_timestamp || 0;
    }
  } catch (error) {
    logWA.error("Gagal membaca file sync:", error);
  }
  return Math.floor(Date.now() / 1000);
}
export function saveLastSyncedTimestamp(timestampDetik, messageId = null) {
  try {
    const memoryDir = path.dirname(SYNC_FILE);
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    const payload = {
      last_synced_timestamp: timestampDetik,
      last_message_id: messageId,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(SYNC_FILE, JSON.stringify(payload, null, 2));
  } catch (error) {
    logWA.error("[ERROR WRITE SYNC FILE]:", error);
  }
}

