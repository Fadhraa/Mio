import fs from "fs";
import { tool } from "@langchain/core/tools";
import { HABIT_PATH } from "../../paths.js";

export const toolBacaKebiasaan = tool(async () => {
    if (fs.existsSync(HABIT_PATH)) {
        try {
            const fileContent = fs.readFileSync(HABIT_PATH, 'utf-8');

            const data = fileContent ? JSON.parse(fileContent) : {};
            
            if (Object.keys(data).length === 0) {
                return "Tidak ada kebiasaan yang tersimpan tentang Fadhra.";
            }

            let result = "Berikut adalah daftar kebiasaan Fadhra yang tersimpan di memori:\n";
            for (const [kunci, info] of Object.entries(data)) {
                result += `- **${kunci}**: ${info.deskripsi}\n`;
            }
            return result;
        } catch (error) {
            console.error("[Read Habit Error]:", error);
            return `Gagal membaca database kebiasaan: ${error.message}`;
        }
    }
    return "Tidak ada kebiasaan yang tersimpan tentang Fadhra.";
}, {
    name: "baca_kebiasaan",
    description: "Gunakan alat ini untuk membaca seluruh database kebiasaan, preferensi berulang, hobi, dan rutinitas Fadhra. Alat ini berguna ketika Fadhra menanyakan kebiasaannya atau menyuruh Anda memindahkan data kebiasaan ke dokumen lain.",
});
