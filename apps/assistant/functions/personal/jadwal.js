import { tool } from "@langchain/core/tools";
import z from "zod";
import {
  bacaSemuaJadwal,
  tambahJadwalService,
  hapusJadwalService,
} from "../../services/jadwalService.js";

export const toolLihatJadwal = tool(
  async ({}) => {
    const semuaJadwal = bacaSemuaJadwal();
    if (!semuaJadwal || semuaJadwal.length === 0) {
      return "Tidak ada jadwal yang tersimpan di database.";
    }

    return `Berikut adalah semua jadwal Fadhra yang tersimpan di database:\n${JSON.stringify(semuaJadwal, null, 2)}`;
  },
  {
    name: "lihat_jadwal",
    description:
      "Gunakan alat ini untuk membantu Fadhra melihat jadwal yang sudah tercatat di database.",
    schema: z.object({}),
  },
);

export const toolTambahJadwal = tool(
  async ({
    title,
    category,
    frequency,
    day,
    date,
    startTime,
    endTime,
    lecturer,
    room,
    session,
  }) => {
    const jadwalBaru = tambahJadwalService({
      title,
      category,
      frequency,
      day,
      date,
      startTime,
      endTime,
      lecturer,
      room,
      session,
    });

    return `Jadwal "${title}" (${category || "rutinitas"}) berhasil dicatat untuk hari ${day || date} pukul ${startTime} - ${endTime}.`;
  },
  {
    name: "tambah_jadwal",
    description:
      "Mencatat jadwal kuliah, rutinitas, atau agenda acara Fadhra ke database.",
    schema: z.object({
      title: z.string().describe("Nama mata kuliah atau kegiatan"),
      category: z
        .enum(["kuliah", "rutinitas", "kegiatan"])
        .describe("Kategori kegiatan"),
      frequency: z
        .enum(["mingguan", "harian", "sekali_saja"])
        .describe("Frekuensi pengulangan"),
      day: z.string().optional().describe("Nama hari (contoh: Senin, Selasa)"),
      date: z
        .string()
        .optional()
        .describe("Tanggal spesifik jika sekali_saja (contoh: 2026-09-08)"),
      startTime: z.string().describe("Jam mulai format HH:MM (contoh: 08:00)"),
      endTime: z.string().describe("Jam selesai format HH:MM (contoh: 09:40)"),
      lecturer: z
        .string()
        .optional()
        .describe("Nama dosen pengajar (khusus kuliah)"),
      room: z
        .string()
        .optional()
        .describe("Ruangan/Gedung kelas (khusus kuliah, contoh: SAW-03.08)"),
      session: z
        .number()
        .optional()
        .describe("Urutan sesi jam ke- (khusus kuliah)"),
    }),
  },
);

export const toolHapusJadwal = tool(
  async ({ id, activity }) => {
    const dihapus = hapusJadwalService(id);
    if (!dihapus) {
      return `Tidak ditemukan jadwal dengan id "${id}".`;
    }

    const namaJadwal = dihapus.judul || dihapus.kegiatan || activity || id;
    return `Jadwal "${namaJadwal}" berhasil dihapus dari database.`;
  },
  {
    name: "hapus_jadwal",
    description:
      "Gunakan alat ini untuk membantu Fadhra menghapus jadwal yang sudah tidak diperlukan lagi.",
    schema: z.object({
      id: z
        .string()
        .describe(
          "ID unik dari jadwal yang ingin dihapus. Bisa didapatkan dari tool 'lihat_jadwal'.",
        ),
      activity: z
        .string()
        .optional()
        .describe(
          "Nama kegiatan. Hanya untuk konteks, tidak digunakan dalam logika penghapusan.",
        ),
    }),
  },
);

