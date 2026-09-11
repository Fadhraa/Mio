import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Import tool khusus akademik
import { toolMenulisTugas, toolBacaTugas, toolEditTugas } from "./tugas.js";
// nulis doc
import { toolKelolaGoogleDoc } from "./docs.js";
// getcurrent time
import { get_currentTime } from "../get_currentTime.js";

// 1. Inisialisasi Otak Miomi (Kita bisa pakai model yang sama atau berbeda)
const otakMiomi = new ChatOllama({
    model: "minimax-m2.5:cloud", // Ganti dengan model pilihanmu
    // model: "gemma4:31b-cloud",
    temperature: 0.1
});

// 2. Beri Kepribadian dan Instruksi Khusus Miomi
const rulesMiomi = ChatPromptTemplate.fromMessages([
    ["system", `Kamu adalah Miomi, asisten spesialis akademik yang teliti dan cerdas milik Fadhra.
Fokus utamamu HANYA membantu tugas sekolah/kuliah dan kegiatan belajar Fadhra menggunakan tool yang kamu miliki.
ATURAN PENTING:
- Jika Fadhra menyuruh membuat laporan, dokumen panjang, esai, atau google docs, gunakan tool 'kelola_google_doc'.
- Jika laporan atau Google Doc tersebut memerlukan data tugas akademik, Anda WAJIB memanggil 'baca_tugas' terlebih dahulu untuk mengambil datanya, lalu gunakan hasilnya untuk menulis dokumen dengan 'kelola_google_doc'.
- Kamu WAJIB memanggil tool yang sesuai terlebih dahulu untuk melakukan aksi (seperti 'menulis_tugas' untuk mencatat tugas baru) sebelum memberikan laporan.
- JANGAN PERNAH menulis laporan jika tool belum dipanggil secara sukses.
- Cukup respon dengan laporan fakta hasil eksekusi tool secara padat, singkat, dan terstruktur.
- JANGAN memberikan basa-basi, salam pembuka/penutup, atau mengajukan pertanyaan kembali.`],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"]
]);

// 3. Gabungkan Miomi dengan Tool-nya
const toolsMiomi = [toolMenulisTugas, toolBacaTugas, get_currentTime, toolEditTugas, toolKelolaGoogleDoc];
const agenMiomi = createToolCallingAgent({
    llm: otakMiomi,
    prompt: rulesMiomi,
    tools: toolsMiomi
});
const miomiExecutor = new AgentExecutor({ agent: agenMiomi, tools: toolsMiomi });

// 4. JADIKAN MIOMI SEBAGAI "TOOL" UNTUK MIO
export const panggilMiomi = tool(async ({ instruksi }) => {
    console.log(`\n[Koordinasi] Mio sedang meminta bantuan Miomi: "${instruksi}"...\n`);

    // Mio mengirimkan perintah ke Miomi
    const result = await miomiExecutor.invoke({ input: instruksi });
    console.log(`[Miomi Response]: ${result.output}\n`);
    return result.output;
}, {
    name: "panggil_agen_akademik_miomi",
    description: "PENTING: Gunakan alat ini JIKA Fadhra meminta bantuan terkait akademik, tugas sekolah/kuliah, belajar, atau MENCATAT/MENYIMPAN tugas baru. Berikan instruksi yang jelas kepada Miomi agar dia bisa mengerjakannya.",
    schema: z.object({
        instruksi: z.string().describe("Perintah lengkap dan spesifik tentang apa yang harus Miomi kerjakan untuk Fadhra.")
    })
});
