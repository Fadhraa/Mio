import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// tool
import { get_currentTime } from "../get_currentTime.js";
import { toolBacaInformasi } from "./baca_informasi.js";
import { toolBacaKebiasaan } from "./baca_kebiasaan.js";
import { toolTambahJadwal, toolLihatJadwal, toolHapusJadwal } from "./jadwal.js";

// setup Nalomi
const otakNalomi = new ChatOllama({
    model: "minimax-m2.5:cloud",
    // model: "gemma4:31b-cloud",
    temperature: 0.1
});
const rulesMiomi = ChatPromptTemplate.fromMessages([
    ["system", `Kamu adalah Nalomi, asisten spesialis personal yang ramah, sopan, dan sangat teliti.
Fokus utamamu HANYA membantu kegiatan pribadi Fadhra menggunakan tool yang kamu miliki (jadwal, informasi pribadi, kebiasaan/rutinitas).
ATURAN PENTING:
- Kamu WAJIB memanggil tool yang sesuai terlebih dahulu untuk melakukan aksi (seperti 'tambah_jadwal' untuk mencatat jadwal, 'baca_kebiasaan' untuk melihat data kebiasaan) sebelum memberikan laporan.
- JANGAN PERNAH menulis laporan jika tool belum dipanggil secara sukses.
- Cukup respon dengan laporan fakta hasil eksekusi tool secara padat, singkat, dan terstruktur.
- JANGAN memberikan basa-basi, salam pembuka/penutup, atau mengajukan pertanyaan kembali.`],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"]
]);

const toolsNalomi = [get_currentTime, toolBacaInformasi, toolBacaKebiasaan, toolTambahJadwal, toolLihatJadwal, toolHapusJadwal];
const agentNalomi = createToolCallingAgent({
    llm: otakNalomi,
    prompt: rulesMiomi,
    tools: toolsNalomi
});

const nalomiExecutor = new AgentExecutor({ agent: agentNalomi, tools: toolsNalomi });

// JADIKAN MIOMI SEBAGAI "TOOL" UNTUK MIO
export const panggilNalomi = tool(async ({ instruksi }) => {
    console.log(`\n[Koordinasi] Mio sedang meminta bantuan Nalomi: "${instruksi}"...\n`);

    // Mio mengirimkan perintah ke Miomi
    const result = await nalomiExecutor.invoke({ input: instruksi });
    console.log(`[Nalomi Response]: ${result.output}\n`);
    return result.output;
}, {
    name: "panggil_agen_personal_nalomi",
    description: "PENTING: Gunakan alat ini JIKA Fadhra menanyakan informasi/fakta masa lalu (contoh: 'siapa pacarku?', 'apa makanan kesukaanku?') ATAU untuk keperluan pribadi seperti jadwal dan alarm.",
    schema: z.object({
        instruksi: z.string().describe("Perintah lengkap dan spesifik tentang apa yang harus Nalomi kerjakan untuk Fadhra.")
    })
});