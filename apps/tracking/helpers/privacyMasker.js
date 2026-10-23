/**
 * privacyMasker.js
 * Utilitas sanitasi dan sensor data pribadi (PII) sebelum dikirim ke Cloud AI.
 */

const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
} else {
  require("dotenv").config();
}

const USER_NAME = process.env.USER_NAME || "User";
const INFO_JSON_PATH = path.resolve(__dirname, "../../assistant/memory/information.json");

function getMaskMapping() {
  const mapping = {};
  if (USER_NAME && USER_NAME !== "User") {
    mapping[USER_NAME] = "<USER>";
  }
  if (fs.existsSync(INFO_JSON_PATH)) {
    try {
      const info = JSON.parse(fs.readFileSync(INFO_JSON_PATH, "utf-8"));
      if (info.nama_pacar) mapping[info.nama_pacar] = "<PARTNER>";
      if (info.nama_kucing) mapping[info.nama_kucing] = "<PET_CAT>";
      for (const [k, v] of Object.entries(info)) {
        if (typeof v === "string" && v.trim().length > 1 && !mapping[v]) {
          mapping[v] = `<INFO_${k.toUpperCase()}>`;
        }
      }
    } catch (e) {
      // Abaikan error read jika file tidak ada / corrupt
    }
  }
  return mapping;
}

function maskText(text) {
  if (!text || typeof text !== "string") return text;
  const mapping = getMaskMapping();
  let masked = text;
  for (const [real, token] of Object.entries(mapping)) {
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    masked = masked.replace(new RegExp(escaped, "gi"), token);
  }
  // Mask path direktori Windows
  masked = masked.replace(/[a-zA-Z]:\\[^:\s"'`]+/g, "<PATH_DIR>");
  // Mask nomor HP/WhatsApp
  masked = masked.replace(/\b\d{9,15}\b/g, "<PHONE_NUMBER>");
  return masked;
}

function unmaskText(text) {
  if (!text || typeof text !== "string") return text;
  const mapping = getMaskMapping();
  let unmasked = text;
  for (const [real, token] of Object.entries(mapping)) {
    const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    unmasked = unmasked.replace(new RegExp(tokenEscaped, "gi"), real);
  }
  return unmasked;
}

module.exports = {
  getMaskMapping,
  maskText,
  unmaskText,
};
