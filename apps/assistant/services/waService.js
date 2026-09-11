import makeWaSocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { prosesSimpanKeVault } from "./deduplicationService.js";
import { getLastSyncTime, saveLastSyncedTimestamp } from "./waSyncService.js";
import qrcode from "qrcode-terminal";
import { periksaKeamanan } from "./extractors/keamananPrivasi.js";
import {
  ekstrakUrldariTeks,
  ekstrakUrlDanKonteks,
  ambilDataWeb,
} from "./extractors/linkEkstraktor.js";
import {
  deteksiApakahPengumuman,
  ekstrakDokumenPengumuman,
} from "./extractors/announcementEkstraktor.js";
import { prosesEkstraksiGambar } from "./extractors/imageEkstraktor.js";
import { logWA } from "./waLogger.js";
import pino from "pino";
import path from "path";
import fs from "fs";
import { WA_SESSION_DIR } from "../paths.js";

const SESSION_DIR = WA_SESSION_DIR;
let sockWA = null;

let SERVER_BOOT_TIME = Math.floor(Date.now() / 1000);

// Array buffer untuk menampung seluruh item sinkronisasi saat offline
let rekapOffline = [];
let timerDebounceFlush = null;

function bangunTeksRekapOffline(rekapList) {
  const berhasil = rekapList.filter((r) => !r.isDuplicate);
  const duplikat = rekapList.filter((r) => r.isDuplicate);

  let teks = `⚡ *[SINKRONISASI OFFLINE SELESAI]*\n`;
  teks += `Mio berhasil menyinkronkan ${rekapList.length} data yang kamu kirim saat server offline:\n`;

  const gambarList = berhasil.filter((r) => r.tipe === "gambar");
  const pengumumanList = berhasil.filter((r) => r.tipe === "pengumuman");
  const linkList = berhasil.filter((r) => r.tipe === "link");

  if (gambarList.length > 0) {
    teks += `\n📸 *Foto / Tangkapan Layar (${gambarList.length})*:`;
    gambarList.forEach((g, idx) => {
      teks += `\n${idx + 1}. ${g.judul} [${(g.kategori || "umum").toUpperCase()}]`;
    });
  }

  if (pengumumanList.length > 0) {
    teks += `\n\n📢 *Pengumuman (${pengumumanList.length})*:`;
    pengumumanList.forEach((p, idx) => {
      const lampiranInfo = p.lampiranCount ? ` (${p.lampiranCount} lampiran link)` : "";
      teks += `\n${idx + 1}. ${p.judul} [${(p.kategori || "umum").toUpperCase()}]${lampiranInfo}`;
    });
  }

  if (linkList.length > 0) {
    teks += `\n\n🔗 *Tautan / Link (${linkList.length})*:`;
    linkList.forEach((l, idx) => {
      teks += `\n${idx + 1}. ${l.judul} [${(l.kategori || "referensi").toUpperCase()}]`;
    });
  }

  if (duplikat.length > 0) {
    teks += `\n\n⚠️ *${duplikat.length} data duplikat diabaikan / diperbarui timestamp-nya.*`;
  }

  teks += `\n\nSemua data telah berhasil diarsipkan ke Vault SQLite.`;
  return teks.trim();
}

function tampungRekapOffline(sock, targetJid, itemInfo) {
  rekapOffline.push(itemInfo);

  if (timerDebounceFlush) {
    clearTimeout(timerDebounceFlush);
  }

  // Debounce 3.5 detik: tunggu sampai backlog offline selesai mengalir
  timerDebounceFlush = setTimeout(async () => {
    if (rekapOffline.length === 0) return;
    try {
      const teksRekap = bangunTeksRekapOffline(rekapOffline);
      await sock.sendMessage(targetJid, { text: teksRekap });
      logWA.info(
        `⚡ [SYNC DIGEST]: Berhasil mengirimkan rekapitulasi ${rekapOffline.length} item offline ke WhatsApp.`,
      );
    } catch (err) {
      logWA.error("[ERROR SEND SYNC DIGEST]:", err);
    } finally {
      rekapOffline = [];
      timerDebounceFlush = null;
    }
  }, 3500);
}

/**
 * Ekstraksi timestamp numerik (detik) yang aman dari protobuf Baileys (number/Long object)
 */
function ekstrasikonversiTimestamp(rawTimestamp) {
  if (!rawTimestamp) return Math.floor(Date.now() / 1000);
  if (typeof rawTimestamp === "number") return rawTimestamp;
  if (typeof rawTimestamp === "object" && rawTimestamp.low !== undefined)
    return rawTimestamp.low;
  const parsed = Number(rawTimestamp);
  return isNaN(parsed) ? Math.floor(Date.now() / 1000) : parsed;
}

/**
 * Meng-unwrap pembungkus pesan (ephemeral, viewOnce, forwarded) untuk mendapatkan payload asli
 */
function dapatkanPesanUnwrapped(msgContent) {
  if (!msgContent) return {};
  let target = msgContent;
  while (
    target.ephemeralMessage ||
    target.viewOnceMessage ||
    target.viewOnceMessageV2 ||
    target.documentWithCaptionMessage
  ) {
    target =
      target.ephemeralMessage?.message ||
      target.viewOnceMessage?.message ||
      target.viewOnceMessageV2?.message ||
      target.documentWithCaptionMessage?.message ||
      target;
  }
  return target;
}

/**
 * Menghapus pesan secara bersih dari layar obrolan tanpa meninggalkan jejak "Anda menghapus pesan ini"
 */
async function hapusPesanTanpaJejak(sock, msgKey, msgTimestamp, jid) {
  try {
    await sock.chatModify(
      {
        deleteForMe: {
          deleteMedia: true,
          key: msgKey,
          timestamp: msgTimestamp || Math.floor(Date.now() / 1000),
        },
      },
      jid,
    );
  } catch (err) {
    try {
      await sock.sendMessage(jid, { delete: msgKey });
    } catch (e) {}
  }
}

export function koneksiKeWA() {
  return new Promise((resolve, reject) => {
    async function hubungkan() {
      try {
        if (!fs.existsSync(SESSION_DIR)) {
          fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const { version } = await fetchLatestBaileysVersion();

        const createSocket = makeWaSocket.default || makeWaSocket;
        if (sockWA) {
          try {
            sockWA.end();
          } catch (e) {}
        }
        sockWA = createSocket({
          version,
          logger: pino({ level: "silent" }),
          printQRInTerminal: false,
          auth: state,
          browser: ["Mio Personal Assistant", "Chrome", "1.0.0"],
        });
        const TARGET_GROUP_JID = process.env.GROUP_WA_ID;

        sockWA.ev.on("messages.upsert", async ({ messages, type }) => {
          // Terima event "notify" (live) DAN "append" (catch-up / backfill offline)
          if (type !== "notify" && type !== "append") return;
          const lastSyncTime = getLastSyncTime();
          const sortedMessages = messages.sort((a, b) => {
            const tA = ekstrasikonversiTimestamp(a.messageTimestamp);
            const tB = ekstrasikonversiTimestamp(b.messageTimestamp);
            return tA - tB;
          });

          for (const msg of sortedMessages) {
            // Filter 1: Pesan dari diri sendiri
            if (!msg.key.fromMe) continue;

            // Filter 2: Harus dikirim di Grup Khusus Mio
            if (msg.key.remoteJid !== TARGET_GROUP_JID) continue;

            const msgTimestamp = ekstrasikonversiTimestamp(msg.messageTimestamp);
            if (msgTimestamp <= lastSyncTime) {
              continue;
            }

            const unwrapMsg = dapatkanPesanUnwrapped(msg.message);

            const teksPesan =
              unwrapMsg?.conversation ||
              unwrapMsg?.extendedTextMessage?.text ||
              unwrapMsg?.imageMessage?.caption ||
              unwrapMsg?.documentMessage?.caption ||
              "";

            const isGambar = !!unwrapMsg?.imageMessage;
            if (!teksPesan && !isGambar) continue;

            const isOfflineCatchUp =
              type === "append" || msgTimestamp < (SERVER_BOOT_TIME - 3);

            logWA.info(
              `📨 [INCOMING VAULT CHAT (${isOfflineCatchUp ? "OFFLINE CATCH-UP" : "LIVE ONLINE"})]: ${teksPesan || "[Gambar/Foto Praktikum]"}`,
            );
            // Privacy Guardrail Check
            const cekSensitif = periksaKeamanan(teksPesan);
            if (cekSensitif.isSensitive) {
              logWA.warn(
                `🔒 [PRIVACY GUARDRAIL TRIGGERED]: ${cekSensitif.alasan}`,
              );
              logWA.warn(
                `Pesan dibatalkan dari pengolahan AI Cloud demi keamanan data.`,
              );
              if (msg.key.id) {
                saveLastSyncedTimestamp(msgTimestamp, msg.key.id);
              }
              continue;
            }

            // 1. Periksa apakah pesan ini adalah DOKUMEN PENGUMUMAN UTUH
            const isPengumuman = deteksiApakahPengumuman(teksPesan);
            if (isPengumuman) {
              logWA.info(
                `📢 [PENGUMUMAN UTUH TERDETEKSI]: Mengolah broadcast sebagai 1 dokumen utuh...`,
              );
              const dataPengumuman = ekstrakDokumenPengumuman(teksPesan);
              const hasilVault = await prosesSimpanKeVault(dataPengumuman);

              if (isOfflineCatchUp) {
                // Mode Offline: Tampung ke array digest tanpa mengirim spam balasan
                tampungRekapOffline(sockWA, msg.key.remoteJid, {
                  tipe: "pengumuman",
                  judul: hasilVault.item.judul,
                  kategori: hasilVault.item.kategori,
                  isDuplicate: hasilVault.isDuplicate,
                  lampiranCount: dataPengumuman.metadata_links?.length || 0,
                });
              } else {
                // Mode Online: Balas instan detik itu juga
                let balasanWA = "";
                if (hasilVault.isDuplicate) {
                  const tglAwal = new Date(hasilVault.item.created_at).toLocaleDateString("id-ID");
                  balasanWA = `⚠️ *[PENGUMUMAN DUPLIKAT]*\nPengumuman ini sudah pernah kamu simpan pada ${tglAwal}.\n📌 *Judul*: ${hasilVault.item.judul}`;
                } else {
                  balasanWA = `📢 *[PENGUMUMAN TERSIMPAN KE VAULT]*\n📌 *Judul*: ${hasilVault.item.judul}\n📂 *Kategori*: ${hasilVault.item.kategori.toUpperCase()}`;
                  if (dataPengumuman.metadata_links && dataPengumuman.metadata_links.length > 0) {
                    balasanWA += `\n🔗 *Lampiran (${dataPengumuman.metadata_links.length} Tautan)*:`;
                    dataPengumuman.metadata_links.forEach((l, idx) => {
                      const label = l.labelKonteks ? `${l.labelKonteks}: ` : "";
                      balasanWA += `\n${idx + 1}. ${label}${l.url}`;
                    });
                  }
                  balasanWA += `\n\n📝 *Ringkasan*: ${hasilVault.item.ringkasan}`;
                }

                const pesanPeringatan = await sockWA.sendMessage(
                  msg.key.remoteJid,
                  { text: balasanWA },
                  { quoted: msg },
                );

                if (hasilVault.isDuplicate) {
                  setTimeout(async () => {
                    try {
                      await hapusPesanTanpaJejak(sockWA, msg.key, msgTimestamp, msg.key.remoteJid);
                      if (pesanPeringatan?.key) {
                        await hapusPesanTanpaJejak(sockWA, pesanPeringatan.key, Math.floor(Date.now() / 1000), msg.key.remoteJid);
                      }
                      logWA.info("🧹 [AUTO-CLEANUP]: Pengumuman duplikat telah dibersihkan.");
                    } catch (e) {
                      logWA.error("[ERROR AUTO-CLEANUP]:", e);
                    }
                  }, 5000);
                }
              }

              if (msg.key.id) {
                saveLastSyncedTimestamp(msgTimestamp, msg.key.id);
              }
              continue; // Selesai mengolah pengumuman, jangan dipecah per-link!
            }

            // 2. Olah Tautan (URL) Biasa (Batch Processing)
            const itemUrls = ekstrakUrlDanKonteks(teksPesan);
            if (itemUrls.length > 0) {
              logWA.info(`🔗 Mengolah ${itemUrls.length} Tautan Unik...`);
              const hasilBatch = [];

              for (const item of itemUrls) {
                try {
                  const metadata = await ambilDataWeb(item.url);
                  if (
                    item.labelKonteks &&
                    (metadata.judul === "Tautan Web" ||
                      metadata.judul.includes("Google Drive") ||
                      metadata.judul.includes("Sign-in"))
                  ) {
                    metadata.judul = `${item.labelKonteks} (${metadata.judul})`;
                  }

                  const hasilVault = await prosesSimpanKeVault(metadata);
                  hasilBatch.push({ ...hasilVault, url: item.url });
                } catch (e) {
                  logWA.error(`Gagal memproses link ${item.url}:`, e);
                }
              }

              const itemBaru = hasilBatch.filter((h) => !h.isDuplicate);
              const itemDuplikat = hasilBatch.filter((h) => h.isDuplicate);

              if (isOfflineCatchUp) {
                // Mode Offline: Masukkan seluruh link ke array rekap
                hasilBatch.forEach((b) => {
                  tampungRekapOffline(sockWA, msg.key.remoteJid, {
                    tipe: "link",
                    judul: b.item.judul,
                    kategori: b.item.kategori,
                    isDuplicate: b.isDuplicate,
                  });
                });
              } else {
                // Mode Online: Balas instan konsolidasi
                let balasanWA = "";
                if (itemBaru.length > 0) {
                  balasanWA += `✅ *[${itemBaru.length} TAUTAN DISIMPAN KE VAULT]*\n`;
                  itemBaru.forEach((b, idx) => {
                    balasanWA += `\n${idx + 1}. *${b.item.judul}* [${b.item.kategori.toUpperCase()}]\n   🔗 ${b.url}`;
                  });
                }

                if (itemDuplikat.length > 0) {
                  balasanWA += `\n\n⚠️ *[${itemDuplikat.length} TAUTAN DUPLIKAT DIABAIKAN]*`;
                }

                const pesanPeringatan = await sockWA.sendMessage(
                  msg.key.remoteJid,
                  { text: balasanWA.trim() },
                  { quoted: msg },
                );

                const semuaDuplikat = itemBaru.length === 0 && itemDuplikat.length > 0;
                if (semuaDuplikat) {
                  setTimeout(async () => {
                    try {
                      await hapusPesanTanpaJejak(sockWA, msg.key, msgTimestamp, msg.key.remoteJid);
                      if (pesanPeringatan?.key) {
                        await hapusPesanTanpaJejak(sockWA, pesanPeringatan.key, Math.floor(Date.now() / 1000), msg.key.remoteJid);
                      }
                      logWA.info("🧹 [AUTO-CLEANUP]: Pesan dihapus karena seluruh link adalah duplikat.");
                    } catch (e) {
                      logWA.error("[ERROR AUTO-CLEANUP]:", e);
                    }
                  }, 5000);
                }
              }
            }
            // 3. Olah Gambar jika ada
            if (isGambar) {
              logWA.info(
                `📸 Mengolah Gambar/Screenshot via Gemini Vision & Menyimpan File...`,
              );
              const hasilGambar = await prosesEkstraksiGambar(msg, msg.key);
              if (hasilGambar) {
                const hasilVault = await prosesSimpanKeVault(hasilGambar);

                if (isOfflineCatchUp) {
                  // Mode Offline: Tampung ke array rekap
                  tampungRekapOffline(sockWA, msg.key.remoteJid, {
                    tipe: "gambar",
                    judul: hasilVault.item.judul,
                    kategori: hasilVault.item.kategori,
                    isDuplicate: hasilVault.isDuplicate,
                  });
                } else {
                  // Mode Online: Balas instan quote
                  let balasanWA = "";
                  if (hasilVault.isDuplicate) {
                    const tglAwal = new Date(
                      hasilVault.item.created_at,
                    ).toLocaleDateString("id-ID");
                    balasanWA = `⚠️ *[DATA DUPLIKAT]*\nGambar/Screenshot ini sudah pernah kamu simpan pada ${tglAwal}. (Pesan ini akan dibersihkan dalam 5 detik)`;
                  } else {
                    balasanWA = `✅ *[TERSIMPAN KE VAULT]*\n📌 *Kategori*: ${hasilVault.item.kategori.toUpperCase()}\n📌 *Judul*: ${hasilVault.item.judul}\n📝 ${hasilVault.item.ringkasan}`;
                  }

                  const pesanPeringatan = await sockWA.sendMessage(
                    msg.key.remoteJid,
                    { text: balasanWA },
                    { quoted: msg },
                  );

                  if (hasilVault.isDuplicate) {
                    setTimeout(async () => {
                      try {
                        await hapusPesanTanpaJejak(
                          sockWA,
                          msg.key,
                          msgTimestamp,
                          msg.key.remoteJid,
                        );
                        if (pesanPeringatan?.key) {
                          await hapusPesanTanpaJejak(
                            sockWA,
                            pesanPeringatan.key,
                            Math.floor(Date.now() / 1000),
                            msg.key.remoteJid,
                          );
                        }
                        logWA.info(
                          "🧹 [AUTO-CLEANUP]: Foto duplikat & peringatan telah dibersihkan bersih tanpa jejak!",
                        );
                      } catch (e) {
                        logWA.error("[ERROR AUTO-CLEANUP]:", e);
                      }
                    }, 5000);
                  }
                }
              }
            }
            if (msg.key.id) {
              saveLastSyncedTimestamp(msgTimestamp, msg.key.id);
            }
          }
        });
        let retryCount = 0;

        sockWA.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            console.log(
              "\n======================================================",
            );
            console.log(
              "SILAKAN SCAN QR CODE DI BAWAH DENGAN WHATSAPP HP KAMU:",
            );
            console.log(
              "======================================================\n",
            );
            qrcode.generate(qr, { small: true });
            console.log(
              "\n*Buka WA di HP -> Perangkat Tertaut (Linked Devices) -> Tautkan Perangkat*\n",
            );
            logWA.info("QR Code generated for WhatsApp authentication.");
          }

          if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logWA.warn(
              `Koneksi WhatsApp terputus. Status Code: ${statusCode}. Reconnect: ${shouldReconnect}`,
            );

            if (shouldReconnect) {
              retryCount++;
              // Jeda bertahap (Exponential Backoff): 3d -> 5d -> 8d -> max 30d
              const delayDetik = Math.min(3000 * Math.pow(1.5, retryCount - 1), 30000);
              logWA.info(
                `Mencoba menyambung kembali ke WhatsApp (Percobaan ke-${retryCount}) dalam ${Math.round(delayDetik / 1000)} detik...`,
              );
              setTimeout(() => {
                hubungkan();
              }, delayDetik);
            } else {
              logWA.error(
                "Sesi di-logout dari HP. Menghapus folder Wa_session...",
              );
              await fs.promises.rm(SESSION_DIR, {
                recursive: true,
                force: true,
              });
              sockWA = null;
              logWA.info("Sesi folder Wa_session sudah dihapus.");
            }
          } else if (connection === "open") {
            retryCount = 0; // Reset hitungan retry saat berhasil terhubung
            SERVER_BOOT_TIME = Math.floor(Date.now() / 1000);
            logWA.info("✅ WHATSAPP MIO BERHASIL TERHUBUNG & SESI TERSIMPAN!");
            resolve(sockWA); // Resolusi Promise saat koneksi sukses terbuka
          }
        });
        sockWA.ev.on("creds.update", saveCreds);

      } catch (error) {
        logWA.error("Gagal menghubungkan ke WhatsApp:", error);
        reject(error);
      }
    }
    hubungkan();
  });
}

export function dapatkanSocketWA() {
  return sockWA;
}

