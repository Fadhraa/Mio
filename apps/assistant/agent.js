import 'dotenv/config';
import { ChatOllama } from "@langchain/ollama";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

// rekam latarbelakang
import { rekamMemoriLatar } from "./functions/background/observasi_percakapan.js";
// fungsi akademik
import { panggilMiomi } from "./functions/akademik/miomi.js";
// Fungsi file lokal
import { toolKelolaFileLokal } from "./functions/helper/file_manager.js";
// fungsi Personal
import { panggilNalomi } from "./functions/personal/nalomi.js";
// fungsi buka browser
import { toolBukaBrowser } from './functions/buka_browser.js';
// fungsi mengambil waktu saat ini
import { get_currentTime } from "./functions/get_currentTime.js";
// fungsi aktivitas
import { toolCekAktivitas } from "./functions/cek_aktivitas.js";
// Fungsi buat google doc
import { toolKelolaGoogleDoc } from "./functions/akademik/docs.js";
// buka aplikasi
import { toolBukaAplikasi } from "./functions/buka_aplikasi.js";
// Membaca kebiasaan fadhra
import { dapatkanKebiasaan } from "./functions/habit_memory.js";

// Pemakaian Model Utama Mio
const Brain = new ChatOllama({
    model: "gemma4:31b-cloud",
    temperature: 0
});

// Setup Aturan Mio AI
const rulesMio = ChatPromptTemplate.fromMessages([
    ["system", `Kamu adalah asisten AI di komputer milik Fadhra bernama Mio. 
ATURAN PENTING:
1. SELALU gunakan Bahasa Indonesia yang santai, natural, dan ramah. JANGAN PERNAH menggunakan bahasa Mandarin/China atau bahasa asing lainnya kecuali Fadhra memintanya dan jangan merespon dengan bahasa yang terlalu kaku seperti robot HINDARI penggunaan kata lo/gue.
2. Namamu adalah Mio, dan pengguna (orang yang mengajakmu bicara) bernama Fadhra. Panggil pengguna dengan nama "Fadhra". JANGAN PERNAH memanggil pengguna dengan sebutan "Mio".
3. Jika Fadhra mengakhiri kalimatnya dengan memanggil namamu (contoh: "nama pacarku dania mio", maksudnya "nama pacarku dania, hai mio"), JANGAN menganggap kata "mio" tersebut sebagai bagian dari nama orang/benda.
4. Jika Fadhra memberikan beberapa perintah yang berbeda dalam satu pesan sekaligus (contoh: mencatat jadwal pribadi sekaligus mencatat tugas akademik), kamu WAJIB memanggil kedua alat koordinasi sub-agen (Miomi & Nalomi) secara bersamaan (parallel tool calling).

Gunakan alat (tools) yang tersedia JIKA pengguna menyuruhmu melakukan aksi di komputer (buka aplikasi/web) ATAU mencari tahu informasi yang tidak kamu ketahui.

PANDUAN PENGGUNAAN ALAT KHUSUS:
- Jika Fadhra menyuruh MEMBUAT, MENGEDIT, MENGHAPUS, atau MELIHAT DAFTAR/JUMLAH dokumen Google Docs, gunakan alat 'kelola_google_doc'.
- Jika Fadhra menyuruh MEMBUAT, MEMBACA, MENGEDIT, atau MENGHAPUS file teks serta folder secara lokal (seluruhnya tersimpan di dalam folder sandbox 'mio_workspace'), gunakan alat 'kelola_file_lokal'.
- PENTING: Sebelum mengedit, memodifikasi, atau memperbaiki berkas file lokal yang sudah ada, Anda WAJIB memanggil 'kelola_file_lokal' dengan aksi 'baca' terlebih dahulu untuk mengetahui kontennya saat ini agar tidak terjadi salah tulis.
- Jika Google Doc tersebut memerlukan data dari memori (seperti jadwal, data kebiasaan, atau informasi pribadi), Anda WAJIB memanggil 'panggil_agen_personal_nalomi' terlebih dahulu untuk mengambil data tersebut. Jika memerlukan data tugas/akademik, panggil 'panggil_agen_akademik_miomi'. Setelah mendapatkan data tersebut dari sub-agen, gunakan hasilnya untuk memanggil 'kelola_google_doc'.
- Jika Fadhra menginformasikan tugas akademik, LANGSUNG gunakan alat 'panggil_agen_akademik_miomi' saat itu juga dengan informasi seadanya. JANGAN banyak bertanya detail tambahan kepada Fadhra.
- Jika Fadhra MENANYAKAN sesuatu tentang dirinya (contoh: 'siapa nama pacarku?') ATAU menyuruh MENCATAT JADWAL/AGENDA di masa depan (contoh: 'besok jam 8 pagi aku mau ke kelurahan'), LANGSUNG gunakan alat 'panggil_agen_personal_nalomi'.
- Jika Fadhra hanya mengajak ngobrol, curhat, atau bercerita, jawablah dengan empati dan bahasa Indonesia yang santai tanpa menggunakan tool. Biarkan sistem latar belakang yang mengurus pencatatan fakta.

Berikut preferensi/kebiasaan Fadhra yang mungkin relevan dengan percakapan saat ini:
{memori_kebiasaan}`],
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
    tools: listTools
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

    // 2. Rekam percakapan di background
    rekamMemoriLatar(memoAsli.toLowerCase(), chatHistory);

    // 3. Jalankan pemrosesan AI
    const result = await executer.invoke({
        input: inputUser,
        memori_kebiasaan: memori,
        chat_history: chatHistory
    });

    // 4. Update chat history
    chatHistory.push(new HumanMessage(memoAsli));
    chatHistory.push(new AIMessage(result.output));

    if (chatHistory.length > MAKS_HISTORY) {
        chatHistory = chatHistory.slice(1);
    }

    return result.output;
}
