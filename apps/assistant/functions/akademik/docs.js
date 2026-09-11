import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { simpanDoc, cariDoc, hapusDoc, bacaDB } from "../helper/doc_db.js";

function extractDocId(url) {
    if (!url) return null;
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];
    const dMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (dMatch && dMatch[1]) return dMatch[1];
    return null;
}

export const toolKelolaGoogleDoc = tool(async ({ tujuan, title, content, documentId }) => {
    console.log(`[Google Docs Tool] Dipanggil dengan parameter: tujuan="${tujuan}", title="${title}", content="${content}", documentId="${documentId}"`);
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
    if (!GOOGLE_SCRIPT_URL && tujuan !== "daftar") {
        return "Gagal mengelola Google Doc: GOOGLE_SCRIPT_URL tidak ditemukan di .env";
    }

    try {
        // Aksi: DAFTAR DOKUMEN (lokal)
        if (tujuan === "daftar") {
            const db = bacaDB();
            const entries = Object.entries(db);
            if (entries.length === 0) {
                return "Tidak ada dokumen Google Docs yang tersimpan di database lokal.";
            }
            let res = "Berikut daftar Google Docs yang tersimpan di database lokal:\n";
            entries.forEach(([id, info], idx) => {
                res += `${idx + 1}. Judul: "${info.title}" | ID: ${id} | Tautan: ${info.url}\n`;
            });
            console.log(`[Google Docs Tool] Berhasil membaca daftar dokumen lokal.`);
            return res;
        }

        let finalDocId = documentId || null;

        // Jika tujuan edit/hapus dan tidak ada ID, coba cari berdasarkan judul di Database lokal
        if ((tujuan === "edit" || tujuan === "hapus") && !finalDocId && title) {
            const found = cariDoc(title);
            if (found) {
                finalDocId = found.id;
                console.log(`[Google Docs Tool] Menemukan ID dokumen dari judul "${title}": ${finalDocId}`);
            } else {
                return `Gagal: Dokumen dengan judul atau kata kunci "${title}" tidak ditemukan di database lokal.`;
            }
        }

        const payload = { action: tujuan };

        if (tujuan === "buat") {
            payload.title = title || "Dokumen Tanpa Judul";
            payload.content = content || "";
        } else if (tujuan === "edit") {
            if (!finalDocId) return "Gagal: ID dokumen tidak ditemukan untuk diedit.";
            payload.documentId = finalDocId;
            payload.content = content || "";
        } else if (tujuan === "hapus") {
            if (!finalDocId) return "Gagal: ID dokumen tidak ditemukan untuk dihapus.";
            payload.documentId = finalDocId;
        }

        console.log(`[Google Docs Tool] Mengirim payload ke Google Apps Script:`, JSON.stringify(payload));

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();
        console.log(`[Google Docs Tool] Respon dari Google Apps Script:`, JSON.stringify(result));
        if (result.status === "error") throw new Error(result.message);

        // Update database lokal berdasarkan hasil
        if (tujuan === "buat") {
            const docId = result.documentId || extractDocId(result.url) || "unknown";
            simpanDoc(docId, payload.title, result.url);
            return `Sukses membuat Google Doc baru!\nJudul: "${payload.title}"\nTautan: ${result.url}\nID: ${docId}`;
        } else if (tujuan === "edit") {
            return `Sukses mengedit/menambahkan isi dokumen!\nTautan: ${result.url}`;
        } else if (tujuan === "hapus") {
            hapusDoc(payload.documentId);
            return `Sukses menghapus dokumen dari Google Drive dan database lokal.`;
        }

    } catch (error) {
        console.error("[Google Docs Error]:", error);
        return `Gagal mengelola Google Doc: ${error.message}`;
    }
}, {
    name: "kelola_google_doc",
    description: "Gunakan alat ini untuk MEMBUAT, MENGEDIT (append teks), MENGHAPUS, atau MELIHAT DAFTAR dokumen Google Docs yang tersimpan di database lokal. Alat ini otomatis mencari ID dokumen di database lokal berdasarkan judul jika parameter 'documentId' kosong.",
    schema: z.object({
        tujuan: z.enum(["buat", "edit", "hapus", "daftar"]).describe("Tujuan aksi dokumen: 'buat' untuk dokumen baru, 'edit' untuk menambah konten ke dokumen lama, 'hapus' untuk memindah ke tempat sampah, 'daftar' untuk melihat daftar seluruh Google Doc yang pernah dibuat."),
        title: z.string().optional().describe("Judul dokumen (Wajib diisi untuk aksi 'buat'. Untuk 'edit' atau 'hapus', bisa diisi nama/kata kunci judul jika ID dokumen tidak diketahui)."),
        content: z.string().optional().describe("Konten teks yang akan ditulis atau ditambahkan (Wajib diisi untuk aksi 'buat' dan 'edit')."),
        documentId: z.string().optional().describe("ID Google Docs spesifik jika sudah diketahui. Kosongkan jika ingin mencari otomatis berdasarkan judul.")
    })
});
