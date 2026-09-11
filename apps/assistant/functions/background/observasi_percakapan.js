import { ChatOllama } from "@langchain/ollama";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { kelolaInformasiUser } from "../personal/kelola_informasi.js";
import { toolCatatKebiasaan } from "../personal/catat_kebiasaan.js";
import { get_currentTime } from "../get_currentTime.js";
import { USER_NAME } from "../../paths.js";

const otakObserver = new ChatOllama({
    model: "devstral-2:123b-cloud",
    temperature: 0.1,
    think: false,
});

const rulesObserver = ChatPromptTemplate.fromMessages([
    ["system", `Tugasmu HANYA membaca kalimat ${USER_NAME} dan mengekstrak informasi. 
ATURAN EKSTRAKSI:
1. JANGAN memasukkan kata-kata imbuhan/basa-basi (seperti "loh", "sih", "dong", "deh") ke dalam data yang dicatat.
2. JANGAN memasukkan kata "Mio" sebagai bagian dari data jika itu berada di akhir kalimat (itu adalah nama asisten).
3. Jika ${USER_NAME} menyebutkan FAKTA STATIS tentang dirinya atau sekitarnya (biodata, keluarga, pacar, HEWAN PELIHARAAN, teman, barang, atau sifat mereka), gunakan kelola_informasi_user.
4. Jika ${USER_NAME} menyebutkan KEBIASAAN/PREFERENSI (rutinitas, hobi, suka/tidak suka), gunakan catat_kebiasaan.
JIKA TIDAK ADA informasi apa-apa (hanya sapaan basi-basi atau perintah akademik), JANGAN gunakan alat apapun dan balas 'KOSONG'.`],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"]
]);

const toolsObserver = [
    kelolaInformasiUser,
    toolCatatKebiasaan,
    get_currentTime,
];

const agentObserver = createToolCallingAgent({
    llm: otakObserver,
    prompt: rulesObserver,
    tools: toolsObserver
});

const observerExecutor = new AgentExecutor({ agent: agentObserver, tools: toolsObserver });

export async function rekamMemoriLatar(promptUser, chatHistory) {
    try {
        await observerExecutor.invoke({
            input: promptUser,
            chat_history: chatHistory || []
        });
    } catch (error) {
        // Abaikan error
    }
}
