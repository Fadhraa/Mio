import "dotenv/config";
import { ChatOllama } from "@langchain/ollama";
import {
  createToolCallingAgent,
  AgentExecutor,
} from "@langchain/classic/agents";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

// rekam latarbelakang
import { rekamMemoriLatar } from "./functions/background/observasi_percakapan.js";
// fungsi akademik
import { panggilMiomi } from "./functions/akademik/miomi.js";
// Fungsi file lokal
import { toolKelolaFileLokal } from "./functions/helper/file_manager.js";
// fungsi Personal
import { panggilNalomi } from "./functions/personal/nalomi.js";
// fungsi buka browser
import { toolBukaBrowser } from "./functions/buka_browser.js";
// fungsi mengambil waktu saat ini
import { get_currentTime } from "./functions/get_currentTime.js";
// fungsi aktivitas
import { toolCekAktivitas } from "./functions/cek_aktivitas.js";
// Fungsi buat google doc
import { toolKelolaGoogleDoc } from "./functions/akademik/docs.js";
// buka aplikasi
import { toolBukaAplikasi } from "./functions/buka_aplikasi.js";
// Membaca kebiasaan pengguna
import { dapatkanKebiasaan } from "./functions/habit_memory.js";

import { USER_NAME } from "./paths.js";
import { maskText, unmaskText } from "./utils/privacyMasker.js";

// Pemakaian Model Utama Mio (Model Cloud Berkemampuan Reasoning Tinggi)
const Brain = new ChatOllama({
  model: "gemma4:31b-cloud",
  temperature: 0.1,
});

// Setup Aturan Mio AI
const rulesMio = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah asisten AI di komputer milik ${USER_NAME} bernama Mio. Panggil pengguna dengan nama "${USER_NAME}" dan sebut dirimu "Mio".

ATURAN PENTING:
1. SELALU gunakan Bahasa Indonesia yang santai, natural, dan ramah. HINDARI bahasa yang kaku seperti robot.
2. Namamu adalah Mio, dan pengguna adalah ${USER_NAME}. JANGAN PERNAH memanggil ${USER_NAME} dengan sebutan "Mio".
3. KEBIJAKAN PRIVASI & INTEGRITAS TOKEN: Sistem menggunakan token pelindung privasi (seperti <USER_INDIVIDUAL>, <RELATION_PARTNER>, <PET_CAT>, <CAT_COLOR>, dsb). Jika kamu melihat token bertanda kurung siku sudut (<...>) dari laporan alat atau input, PERTAHANKAN token tersebut secara persis dalam responmu tanpa mengubah huruf, spasi, atau menghapusnya. Sistem lokal akan menerjemahkannya kembali untuk pengguna.
4. Seluruh fakta tentang keluarga, pacar, teman, atau hewan peliharaan adalah milik ${USER_NAME}, BUKAN milik Mio.
5. PRIORITAS FAKTA & NAMA ORANG: Jika ${USER_NAME} menanyakan tentang seseorang (contoh: "kamu tau siapa budi?", "siapa pacarku?"), kamu WAJIB LANGSUNG memanggil 'panggil_agen_personal_nalomi'. DILARANG KERAS langsung menjawab "saya tidak tahu" sebelum mengecek alat tersebut!
6. Jika ${USER_NAME} memberikan beberapa perintah berbeda sekaligus, panggil sub-agen yang relevan secara bersamaan (parallel tool calling).

PANDUAN PENGGUNAAN ALAT:
- Jika ${USER_NAME} menanyakan tentang dirinya, nama orang di sekitarnya, pacar, teman, hewan peliharaan, ATAU meminta mencatat jadwal: LANGSUNG panggil 'panggil_agen_personal_nalomi'.
- Jika ${USER_NAME} menginformasikan atau menanyakan tugas akademik/kuliah: LANGSUNG panggil 'panggil_agen_akademik_miomi'.
- Jika ${USER_NAME} menyuruh membuka program di komputer: gunakan 'buka_aplikasi_komputer'.
- Jika ${USER_NAME} menyuruh membuka situs/website: gunakan 'buka_browser'.
- Jika ${USER_NAME} menyuruh membuat/membaca berkas lokal: gunakan 'kelola_file_lokal'.
- Jika ${USER_NAME} menyuruh membuat dokumen Google Docs: gunakan 'kelola_google_doc'.
- HANYA jika ${USER_NAME} sekadar menyapa (seperti "halo", "pagi") atau curhat tanpa menanyakan nama/fakta/perintah, jawablah dengan ramah tanpa menggunakan tool.

Berikut preferensi/kebiasaan ${USER_NAME} yang mungkin relevan:
{memori_kebiasaan}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const listTools = [
  toolBukaBrowser,
  get_currentTime,
  toolCekAktivitas,
  toolBukaAplikasi,
  toolKelolaGoogleDoc,
  toolKelolaFileLokal,
  panggilMiomi,
  panggilNalomi,
];

// Membuat Agen
const Mio = createToolCallingAgent({
  llm: Brain,
  prompt: rulesMio,
  tools: listTools,
});

// Wrapping agent dalam executor
export const executer = new AgentExecutor({ agent: Mio, tools: listTools });

// Memori Jangka Pendek (Short Term Memory) yang akan di-share antara CLI & Web UI
export let chatHistory = [];
const MAKS_HISTORY = 10;

// Fungsi terpadu untuk menjalankan logika berpikir Mio
export async function jalankanMio(inputUser, humanMessageText = null) {
  const promptUser = inputUser.toLowerCase();
  const memoAsli = humanMessageText || inputUser;

  // 1. Ambil kebiasaan relevan
  const memori = await dapatkanKebiasaan(promptUser);

  // 2. Rekam percakapan di background (Lokal)
  rekamMemoriLatar(memoAsli.toLowerCase(), chatHistory);

  // 3. Masking PII pada input pengguna sebelum dikirimkan ke model Cloud
  const inputTersensor = maskText(inputUser);
  const memoriTersensor = maskText(memori);

  // 4. Jalankan pemrosesan AI di Cloud
  const result = await executer.invoke({
    input: inputTersensor,
    memori_kebiasaan: memoriTersensor,
    chat_history: chatHistory,
  });

  // 5. Unmasking teks keluaran dari Cloud AI agar pengguna membaca nama asli yang alami
  const outputFinal = unmaskText(result.output);

  // 6. Update chat history dengan teks alami
  chatHistory.push(new HumanMessage(memoAsli));
  chatHistory.push(new AIMessage(outputFinal));

  if (chatHistory.length > MAKS_HISTORY) {
    chatHistory = chatHistory.slice(1);
  }

  return outputFinal;
}
