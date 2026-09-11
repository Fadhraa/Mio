import fs from "fs";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { INFORMATION_PATH, USER_NAME } from "../../paths.js";

export const kelolaInformasiUser = tool(async ({ key, value }) => {
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
        return `Informasi tentang ${USER_NAME} berhasil disimpan: ${key}: ${value}`;
    } catch (error) {

        return `Gagal menyimpan informasi: ${error.message}`;
    }
}, {
    name: "kelola_informasi_user",
    description: "Gunakan alat ini jika pengguna memberikan informasi tentang dirinya atau sekitarnya yang harus diingat.",
    schema: z.object({
        key: z.string().describe("Kunci informasi yang akan disimpan"),
        value: z.string().describe("Nilai informasi yang akan disimpan")
    })
})