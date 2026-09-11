import fs from "fs";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { INFORMATION_PATH } from "../../paths.js";

export const kelolaInformasiFadhra = tool(async ({ key, value }) => {
    try {
        let data = {};
        if (fs.existsSync(INFORMATION_PATH)) {
            data = JSON.parse(fs.readFileSync(INFORMATION_PATH, 'utf-8'));
        }

        
        data[key.toLowerCase()] = value;
        
        const dirPath = path.dirname(INFORMATION_PATH);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(INFORMATION_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return `Informasi tentang Fadhra berhasil disimpan: ${key}: ${value}`;
    } catch (error) {

        return `Gagal menyimpan informasi: ${error.message}`;
    }
}, {
    name: "kelola_informasi_fadhra",
    description: "Gunakan alat ini JIKA Fadhra memberikan informasi apapun itu dan harus diingat. Berikan instruksi yang jelas kepada Nalomi agar dia bisa mengerjakannya.",
    schema: z.object({
        key: z.string().describe("Kunci informasi yang akan disimpan"),
        value: z.string().describe("Nilai informasi yang akan disimpan")
    })
})