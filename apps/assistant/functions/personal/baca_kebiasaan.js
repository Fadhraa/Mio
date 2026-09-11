import fs from "fs";
import { tool } from "@langchain/core/tools";
import { HABIT_PATH, USER_NAME } from "../../paths.js";

export const toolBacaKebiasaan = tool(async () => {
    if (fs.existsSync(HABIT_PATH)) {
        try {
            const fileContent = fs.readFileSync(HABIT_PATH, 'utf-8');

            const data = fileContent ? JSON.parse(fileContent) : {};
            
            if (Object.keys(data).length === 0) {
                return `Tidak ada kebiasaan yang tersimpan tentang ${USER_NAME}.`;
            }

            let result = `Berikut adalah daftar kebiasaan ${USER_NAME} yang tersimpan di memori:\n`;
            for (const [kunci, info] of Object.entries(data)) {
                result += `- **${kunci}**: ${info.deskripsi}\n`;
            }
            return result;
        } catch (error) {
            console.error("[Read Habit Error]:", error);
            return `Gagal membaca database kebiasaan: ${error.message}`;
        }
    }
    return `Tidak ada kebiasaan yang tersimpan tentang ${USER_NAME}.`;
}, {
    name: "baca_kebiasaan",
    description: "Gunakan alat ini untuk membaca seluruh database kebiasaan, preferensi berulang, hobi, dan rutinitas pengguna. Alat ini berguna ketika pengguna menanyakan kebiasaannya atau menyuruh Anda memindahkan data kebiasaan ke dokumen lain.",
});
