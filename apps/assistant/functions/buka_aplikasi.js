import { exec } from "child_process";
import { tool } from '@langchain/core/tools';
import { z } from "zod";

// Daftar "nama rahasia" sistem Windows untuk memanggil aplikasi
const pintasanAplikasi = {
    "notepad": "notepad",
    "kalkulator": "calc",
    "calculator": "calc",
    "vscode": "code",
    "vs code": "code",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "cmd": "cmd",
    "terminal": "wt", // Windows Terminal (jika punya)
    "file explorer": "explorer",
    "folder": "explorer",
    "setting": "ms-settings:", // Membuka pengaturan Windows
    "pengaturan": "ms-settings:",
    // Game
    "nte": "D:\\Neverness To Everness\\NTEGlobal\\NTEGlobalGame.exe",
    "neverness to everness": "D:\\Neverness To Everness\\NTEGlobal\\NTEGlobalGame.exe",
    "neverness": "D:\\Neverness To Everness\\NTEGlobal\\NTEGlobalGame.exe",
    // Variasi untuk Wuthering Waves
    "wuwa": "D:\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe",
    "wuthering waves": "D:\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe",
    "wuthering": "D:\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe",
};

export const toolBukaAplikasi = tool(async ({ nama_aplikasi }) => {
    let command;
    const target = nama_aplikasi.toLowerCase();

    // 1. Cek apakah ada di daftar pintasan kita
    if (pintasanAplikasi[target]) {
        command = pintasanAplikasi[target];
    } else {
        // 2. Jika tidak ada, kita coba tebak saja namanya
        command = target;
    }

    console.log(`Mio sedang mencoba membuka aplikasi: ${nama_aplikasi}...`);

    // Karena proses buka aplikasi butuh waktu, kita pakai sistem Promise
    return new Promise((resolve) => {
        // Perintah `start "" "nama"` adalah cara jitu Windows membuka aplikasi
        exec(`start "" "${command}"`, (error) => {
            if (error) {
                console.error(`Mio: Gagal membuka aplikasi ${nama_aplikasi}.`);

                resolve(`Gagal membuka ${nama_aplikasi}. Beritahu Fadhra bahwa aplikasi tidak ditemukan atau ejaannya salah.`);
            } else {
                // Kembalikan status sukses ke AI
                resolve(`Perintah eksekusi berhasil. Beritahu Fadhra bahwa aplikasi ${nama_aplikasi} sedang diluncurkan, namun ingatkan dia untuk menunggu beberapa saat karena aplikasi/game yang berat membutuhkan proses loading sebelum jendelanya muncul di layar.`);

            }
        });
    });
}, {
    name: 'buka_aplikasi_komputer',
    description: 'Gunakan alat ini KHUSUS untuk membuka aplikasi lokal / program bawaan di dalam komputer (PC/Laptop) pengguna, seperti notepad, kalkulator, vscode, file explorer, dll.',
    schema: z.object({
        nama_aplikasi: z.string().describe('Nama aplikasi yang ingin dibuka, contoh: "notepad", "kalkulator", "vscode"')
    })
});
