import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from 'fs';
import path from 'path';

const overlayPath = path.resolve('../tracking/logs/overlay_status.json');
export const toolCekAktivitas = tool(async () => {
    console.log("Mio sedang membaca layar mu")
    try {
        if (!fs.existsSync(overlayPath)) {
            console.log("File tidak di temukan")
            return "File status overlay tidak ditemukan"
        }
        const dataMentah = fs.readFileSync(overlayPath, 'utf-8');
        const dataJson = JSON.parse(dataMentah);
        if (dataJson.is_idle) {
            return `Beri tahu Fadhra bahwa layarnya sedang tidak aktif. Dia sudah ${dataJson.idle_time} detik tidak melakukan aktivitas.`
        } else {
            return `Beri tahu Fadhra bahwa saat ini dia sedang fokus membuka aplikasi "${dataJson.app}" (Kategori: ${dataJson.category}). Dia sudah membuka aplikasi ini selama ${dataJson.duration} detik.`;
        }
    } catch (error) {
        console.log(error)
        return `Mio tidak bisa membaca layar fadhra karena ada error ${error}`
    }
}, {
    name: 'cek_aktivitas_sekarang',
    description: 'Gunakan alat ini untuk mengetahui aktivitas yang dilakukan fadhra saat ini',
    schema: z.object({})
});