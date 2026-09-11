import fs from "fs";
import { tool } from "langchain";
import z from "zod";
import { INFORMATION_PATH } from "../../paths.js";

export const toolBacaInformasi = tool(async () => {
    if (fs.existsSync(INFORMATION_PATH)) {
        const data = fs.readFileSync(INFORMATION_PATH, 'utf-8');
        return `Berikut adalah semua informasi personal Fadhra di database:\n${data}`;
    }

    return "Tidak ada informasi yang tersimpan tentang Fadhra.";
}, {
    name: "baca_informasi",
    description: "Gunakan alat ini untuk membaca seluruh informasi/database yang tersimpan tentang Fadhra. LLM bisa membaca seluruh datanya dan mencari jawabannya sendiri.",
})

