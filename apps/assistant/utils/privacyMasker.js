import fs from "fs";
import { INFORMATION_PATH, USER_NAME } from "../paths.js";

export const MASK_TOKENS = {
  USER: "<USER_INDIVIDUAL>",
  PACAR: "<RELATION_PARTNER>",
  KUCING: "<PET_CAT>",
  WARNA_KUCING: "<CAT_COLOR>",
};

export function getMaskMapping() {
  const mapping = {};
  if (USER_NAME && USER_NAME !== "User") {
    mapping[USER_NAME] = MASK_TOKENS.USER;
  }
  if (fs.existsSync(INFORMATION_PATH)) {
    try {
      const raw = fs.readFileSync(INFORMATION_PATH, "utf-8");
      const info = JSON.parse(raw);
      if (info.nama_pacar) mapping[info.nama_pacar] = MASK_TOKENS.PACAR;
      if (info.nama_kucing) mapping[info.nama_kucing] = MASK_TOKENS.KUCING;
      if (info.warna_kucing) mapping[info.warna_kucing] = MASK_TOKENS.WARNA_KUCING;
      for (const [k, v] of Object.entries(info)) {
        if (typeof v === "string" && v.trim().length > 1 && !mapping[v]) {
          mapping[v] = `<INFO_${k.toUpperCase()}>`;
        }
      }
    } catch (err) {
      console.warn("[PrivacyMasker] Read err:", err.message);
    }
  }
  return mapping;
}

export function maskText(text) {
  if (!text || typeof text !== "string") return text;
  const mapping = getMaskMapping();
  let masked = text;
  const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const original of sortedKeys) {
    const token = mapping[original];
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    masked = masked.replace(regex, token);
  }
  return masked;
}

export function unmaskText(maskedText) {
  if (!maskedText || typeof maskedText !== "string") return maskedText;
  const mapping = getMaskMapping();
  let unmasked = maskedText;
  for (const [original, token] of Object.entries(mapping)) {
    const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(tokenEscaped, "gi");
    unmasked = unmasked.replace(regex, original);
  }
  return unmasked;
}
