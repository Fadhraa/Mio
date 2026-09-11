import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from 'fs';
import path from 'path';
import { TUGAS_PATH, USER_NAME } from '../../paths.js';

export const toolMenulisTugas = tool(async ({ nama_tugas, tipe_tugas, deadline, status }) => {
    try {
        let semuaTugas = [];
        if (fs.existsSync(TUGAS_PATH)) {
            semuaTugas = JSON.parse(fs.readFileSync(TUGAS_PATH, 'utf-8'))
        }

        const tugasBaru = {
            id: Date.now().toString(),
            nama_tugas,
            tipe_tugas,
            deadline,
            status,
            dicatat_pada: new Date().toISOString(),
        }
        semuaTugas.push(tugasBaru);
        const dirPath = path.dirname(TUGAS_PATH);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }
        fs.writeFileSync(TUGAS_PATH, JSON.stringify(semuaTugas, null, 2), 'utf-8')
        return `Tugas "${nama_tugas}" udah Miomi catat di list tugas.`
    } catch (error) {
        console.log(error)
        return `Mio tidak bisa membantu mencatat tugas ${USER_NAME}, ada kesalahan sistem.`
    }
}, {
    name: 'menulis_tugas',
    description: 'Gunakan alat ini untuk membantu mencatat tugas-tugas yang disampaikan pengguna',
    schema: z.object({
        nama_tugas: z.string().describe('judul atau nama dari tugas tersebut, contoh: "menulis laporan"'),
        tipe_tugas: z.string().describe('Tipe tugas, contoh: "laporan sementara", "laprak", "kti", "esai", "tugas akhir"'),
        deadline: z.string().optional().describe('OPSIONAL, cukup berikan deadline apabila pengguna menyebutkan Deadline tugas, contoh:"25 Desember 2025 Pukul 13.00"'),
        status: z.string().optional().default('belum dikerjakan').describe('OPSIONAL, status tugas, contoh: "belum dikerjakan", "sedang dikerjakan", "selesai"')
    })
});

export const toolBacaTugas = tool(async () => {
    try {
        let semuaTugas = [];
        if (fs.existsSync(TUGAS_PATH)) {
            semuaTugas = JSON.parse(fs.readFileSync(TUGAS_PATH, 'utf-8'));
        }

        if (semuaTugas.length === 0) {
            return `${USER_NAME} tidak punya catatan tugas saat ini.`;
        }

        let ringkasan = `Berikut adalah daftar tugas ${USER_NAME}:\n\n`;

        for (let i = 0; i < semuaTugas.length; i++) {
            const t = semuaTugas[i];
            ringkasan += `   - ID Tugas: ${t.id}\n`;
            ringkasan += `${i + 1}. **${t.nama_tugas.toUpperCase()}**\n`;
            ringkasan += `   - Tipe: ${t.tipe_tugas}\n`;
            ringkasan += `   - Deadline: ${t.deadline || 'Tidak ditentukan'}\n`;
            ringkasan += `   - Status: ${t.status}\n`;
            ringkasan += `   - Dicatat: ${new Date(t.dicatat_pada).toLocaleString()}\n\n`;
        }

        return ringkasan;

    } catch (error) {
        console.log(error)
        return `Miomi tidak bisa membantu membaca list tugas ${USER_NAME}, ada kesalahan sistem.`
    }
}, {
    name: "baca_list_tugas",
    description: "Gunakan alat ini untuk membantu membaca daftar tugas yang sudah dicatat sebelumnya",
    schema: z.object({})

})
export const toolEditTugas = tool(async ({ id, nama_tugas, tipe_tugas, deadline, status }) => {
    try {
        let semuaTugas = [];
        if (fs.existsSync(TUGAS_PATH)) {
            semuaTugas = JSON.parse(fs.readFileSync(TUGAS_PATH, 'utf-8'));
        }
        const tugas = semuaTugas.find(t => t.id === id);
        if (!tugas) {
            return 'Tugas tidak ditemukan.';
        }
        if (nama_tugas) {
            tugas.nama_tugas = nama_tugas;
        }
        if (tipe_tugas) {
            tugas.tipe_tugas = tipe_tugas;
        }
        if (deadline) {
            tugas.deadline = deadline;
        }
        if (status) {
            tugas.status = status;
        }
        fs.writeFileSync(TUGAS_PATH, JSON.stringify(semuaTugas, null, 2), 'utf-8');
        return 'Tugas berhasil diupdate.';
    } catch (error) {
        console.log(error)
        return `Miomi tidak bisa membantu mengedit tugas ${USER_NAME}, ada kesalahan sistem.`
    }
}, {
    name: "edit_tugas",
    description: "Gunakan alat ini untuk membantu mengedit tugas yang sudah dicatat sebelumnya",
    schema: z.object({
        id: z.string().describe('ID dari tugas yang akan diedit'),
        nama_tugas: z.string().optional().describe('OPSIONAL, nama tugas yang akan diubah, contoh: "menulis laporan"'),
        tipe_tugas: z.string().optional().describe('OPSIONAL, tipe tugas yang akan diubah, contoh: "laporan sementara", "laprak", "kti", "esai", "tugas akhir"'),
        deadline: z.string().optional().describe('OPSIONAL, cukup berikan deadline apabila pengguna menyebutkan Deadline tugas, contoh:"25 Desember 2025 Pukul 13.00"'),
        status: z.string().optional().describe('OPSIONAL, status tugas, contoh: "belum dikerjakan", "sedang dikerjakan", "selesai"')
    })
})