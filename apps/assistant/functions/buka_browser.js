import { exec } from "child_process";
import { tool } from '@langchain/core/tools';
import { z } from "zod";
import ytSearch from 'yt-search';

const pintasanWeb = {
    "youtube": "https://www.youtube.com",
    "yt": "https://www.youtube.com",
    "netflix": "https://www.netflix.com",
    "github": "https://github.com",
    "whatsapp": "https://web.whatsapp.com",
    "wa": "https://web.whatsapp.com",
    "chatgpt": "https://chatgpt.com",
    "google": "https://www.google.com"
};

export const toolBukaBrowser = tool(async ({ website, kata_kunci }) => {
    let url;
    const target = website.toLowerCase();


    if (kata_kunci) {
        if (target === "youtube" || target === "yt") {
            console.log(`Mio sedang mencari video "${kata_kunci}"...`);
            // Gunakan format URL pencarian khusus Youtube
            try {
                
                const hasilPencarian = await ytSearch(kata_kunci);
                const videoPertama = hasilPencarian.videos[0]; 

                if (videoPertama) {
                    
                    url = videoPertama.url;
                    console.log(`Menemukan video: ${videoPertama.title}`);
                } else {
                 
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(kata_kunci)}`;
                }
            } catch (err) {
                url = `https://www.youtube.com/results?search_query=${encodeURIComponent(kata_kunci)}`;
            }

        } else {
            // Jika website lain (atau tidak jelas), default cari pakai Google
            url = `https://www.google.com/search?q=${encodeURIComponent(kata_kunci)}`;
        }
        console.log(`Mio sedang mencari "${kata_kunci}" di ${website}...`);
    }
    // 2. JIKA USER HANYA MINTA BUKA BERANDA (contoh: "Buka Youtube")
    else {
        if (pintasanWeb[target]) {
            url = pintasanWeb[target];
        } else if (website.includes('.') && !website.includes(' ')) {
            url = website.startsWith('http') ? website : `https://${website}`;
        } else {
            url = `https://www.google.com/search?q=${encodeURIComponent(website)}`;
        }
        console.log(`Mio sedang membuka halaman beranda ${website}...`);
    }

    // Menjalankan Browser
    exec(`start "" "${url}"`, (error) => {
        if (error) {
            console.error(`Mio: Maaf, gagal membuka browser. Error: ${error.message}`);
        }
    });

    return `Sukses. Browser telah dibuka untuk "${kata_kunci ? kata_kunci : website}"`;

}, {
    name: 'buka_browser',
    description: 'Gunakan alat ini untuk membuka website atau mencari sesuatu di website tertentu.',
    // KEAJAIBAN ZOD ADA DI SINI: Kita minta AI memisahkan datanya
    schema: z.object({
        website: z.string().describe('Situs web target, contoh: "youtube", "google", atau "netflix"'),
        kata_kunci: z.string().optional().describe('Benda/video/lagu spesifik yang ingin dicari di website tersebut. KOSONGKAN jika user hanya ingin membuka halaman depannya saja.')
    })
});
