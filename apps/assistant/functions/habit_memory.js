import fs from 'fs';
import path from 'path';
import { HABIT_PATH } from '../paths.js';

export async function bacaData() {
    try {
        if (fs.existsSync(HABIT_PATH)) {
            const data = fs.readFileSync(HABIT_PATH, 'utf8');
            return data === '' ? {} : JSON.parse(data);
        }
        return {};
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // Kembalikan objek kosong jika file belum dibuat
        }
        throw error;
    }
}

export async function simpanKebiasaan(kunci, deskripsi, target) {
    const data = await bacaData();

    data[kunci.toLowerCase()] = {
        deskripsi,
        target,
        log: [],
        createdAt: new Date().toISOString(),
    }

    const dirPath = path.dirname(HABIT_PATH);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(HABIT_PATH, JSON.stringify(data, null, 2));
}


export async function dapatkanKebiasaan(userInput) {
    const semuaKebiasaan = await bacaData();
    // Hilangkan tanda baca seperti ? ! , . agar tidak mengganggu pencarian
    const kataKunciUser = userInput.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);

    let hasilPencarian = [];

    for (const [kunci, info] of Object.entries(semuaKebiasaan)) {
        const kunciClean = kunci.replace(/_/g, ' ');
        const teksPencarian = `${kunciClean} ${info.deskripsi.toLowerCase()}`;

        // Cek kecocokan kata kunci dengan mengabaikan stopwords umum Bahasa Indonesia
        const isMatch = kataKunciUser.some(kata => {
            if (['di', 'dan', 'ke', 'dari', 'yang', 'untuk', 'buat', 'saya', 'aku', 'biasa', 'biasanya'].includes(kata)) {
                return false;
            }
            return kata.length > 2 && teksPencarian.includes(kata);
        });

        if (isMatch) {
            let detail = `- ${kunci}: ${info.deskripsi}`;
            if (info.target) {
                detail += ` (Target/Aplikasi/URL: "${info.target}")`;
            }
            hasilPencarian.push(detail);
        }
    }

    if (hasilPencarian.length === 0) {
        return "Tidak ada memori kebiasaan yang relevan saat ini.";
    }

    return hasilPencarian.join('\n');
}