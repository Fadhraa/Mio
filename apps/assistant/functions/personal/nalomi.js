import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import {
  createToolCallingAgent,
  AgentExecutor,
} from "@langchain/classic/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// tool
import { get_currentTime } from "../get_currentTime.js";
import { toolBacaInformasi } from "./baca_informasi.js";
import { toolBacaKebiasaan } from "./baca_kebiasaan.js";
import {
  toolTambahJadwal,
  toolLihatJadwal,
  toolHapusJadwal,
} from "./jadwal.js";

import { USER_NAME } from "../../paths.js";
import { maskText, unmaskText } from "../../utils/privacyMasker.js";

// setup Nalomi
const otakNalomi = new ChatOllama({
  model: "gemma4:31b-cloud",
  temperature: 0.1,
});
const rulesMiomi = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah Nalomi, asisten spesialis personal yang ramah, sopan, dan sangat teliti.
Fokus utamamu HANYA membantu kegiatan pribadi ${USER_NAME} menggunakan tool yang kamu miliki.

PANDUAN PEMILIHAN ALAT (WAJIB DIIKUTI):
1. Jika ditanyakan tentang FAKTA PRIBADI, NAMA ORANG/PACAR/TEMAN/KELUARGA, HEWAN PELIHARAAN, atau BIODATA:
   -> Kamu WAJIB memanggil tool 'baca_informasi'. JANGAN memanggil 'baca_kebiasaan'.
2. Jika ditanyakan tentang KEBIASAAN, HOBI, atau RUTINITAS berulang:
   -> Panggil tool 'baca_kebiasaan'.
3. Jika ditanyakan tentang JADWAL, AGENDA, atau KULIAH:
   -> Panggil tool 'lihat_jadwal' atau 'tambah_jadwal'.

ATURAN PENTING:
- Kamu WAJIB memanggil tool yang sesuai terlebih dahulu sebelum memberikan laporan.
- JANGAN PERNAH berasumsi atau menulis laporan sebelum tool berhasil dieksekusi.
- Cukup respon dengan laporan fakta hasil eksekusi tool secara padat, singkat, dan terstruktur.
- JANGAN memberikan basa-basi, salam pembuka/penutup, atau mengajukan pertanyaan kembali.`,
  ],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const toolsNalomi = [
  get_currentTime,
  toolBacaInformasi,
  toolBacaKebiasaan,
  toolTambahJadwal,
  toolLihatJadwal,
  toolHapusJadwal,
];
const agentNalomi = createToolCallingAgent({
  llm: otakNalomi,
  prompt: rulesMiomi,
  tools: toolsNalomi,
});

const nalomiExecutor = new AgentExecutor({
  agent: agentNalomi,
  tools: toolsNalomi,
});

// JADIKAN MIOMI SEBAGAI "TOOL" UNTUK MIO
export const panggilNalomi = tool(
  async ({ instruksi }) => {
    // 1. Unmask instruksi jika ada token placeholder dari Cloud Mio agar Nalomi lokal memahami nama aslinya
    const instruksiLokal = unmaskText(instruksi);
    console.log(
      `\n[Koordinasi] Mio sedang meminta bantuan Nalomi: "${instruksiLokal}"...\n`,
    );

    // 2. Nalomi lokal mengeksekusi dengan model lokal
    const result = await nalomiExecutor.invoke({ input: instruksiLokal });
    console.log(`[Nalomi Response Mentah]: ${result.output}\n`);

    // 3. Mask hasil sebelum dikembalikan ke Cloud Mio agar data sensitif tidak pernah keluar ke server cloud
    const resultTersensor = maskText(result.output);
    console.log(`[Nalomi Response Tersensor ke Cloud]: ${resultTersensor}\n`);
    return resultTersensor;
  },
  {
    name: "panggil_agen_personal_nalomi",
    description:
      "PENTING: Gunakan alat ini JIKA pengguna menanyakan tentang seseorang (contoh: 'kamu tau siapa budi?', 'siapa pacarku?'), informasi/fakta personal masa lalu, atau untuk keperluan pribadi seperti jadwal dan agenda.",
    schema: z.object({
      instruksi: z
        .string()
        .describe(
          "Perintah lengkap dan spesifik tentang apa yang harus Nalomi kerjakan untuk pengguna.",
        ),
    }),
  },
);
