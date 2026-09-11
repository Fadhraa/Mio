import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { simpanKebiasaan } from '../habit_memory.js';
import { USER_NAME } from '../../paths.js';

export const toolCatatKebiasaan = tool(async ({ kunci, deskripsi, target }) => {
    try {
        await simpanKebiasaan(kunci, deskripsi, target || null);
        return `Berhasil mencatat kebiasaan. Ingat ${USER_NAME} juga punya kebiasaan ${kunci}, berikan respon positif tentang kebiasaannya.`;
    } catch (err) {
        return `Gagal mencatat kebiasaan: ${err.message}`;
    }
}, {
    name: 'catat_kebiasaan',
    description: 'Gunakan alat ini SETIAP KALI pengguna memberi tahu KEBIASAAN BERULANG atau PREFERENSINYA (contoh: "aku biasa minum aqua", "saya selalu bangun jam 5"). PENTING: JANGAN gunakan alat ini untuk mencatat FAKTA STATIS (seperti biodata, nama pacar, keluarga, jadwal), gunakan alat kelola_informasi_user untuk fakta statis.',
    schema: z.object({
        kunci: z.string().describe('Kata kunci pendek unik untuk kebiasaan ini (gunakan huruf kecil dan underscore, contoh: "minum_air", "nonton_anime", "menulis_laporan")'),
        deskripsi: z.string().describe('Penjelasan aktivitas atau fakta tersebut'),
        target: z.string().optional().describe('OPSIONAL. Hanya diisi jika kebiasaan berkaitan dengan Nama Aplikasi atau URL website target (contoh: "docs.google.com"). Kosongkan jika ini hanya fakta atau kebiasaan biasa.')
    })
});
