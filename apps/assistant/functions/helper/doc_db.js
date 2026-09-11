import fs from "fs";
import path from "path";
import { DOCS_PATH } from "../../paths.js";

const DB_PATH = DOCS_PATH;

export function bacaDB() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("[DB_INFO] Database dokumen tidak ditemukan")
        return {}
    }

    try {
        const fileContent = fs.readFileSync(DB_PATH, "utf-8");
        return fileContent ? JSON.parse(fileContent) : {};
    } catch (error) {
        console.error("[DB_ERROR] Gagal membaca database:", error);
        return {}
    }
}
// fungsi simpan ke database (JSON)
export function simpanDoc(id, title, url) {
    const db = bacaDB()

    db[id] = {
        title: title,
        url: url,
        createdAt: new Date().toISOString()
    }

    try {
        // cek directory
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8")
        console.log("[DB_SUCCESS] Dokumen berhasil ditambahkan ke database:", title)
    } catch (error) {
        console.error("[DB_ERROR] Gagal menyimpan dokumen ke database:", error)
    }
}
export function cariDoc(keyword) {
    const db = bacaDB()
    const cleanKeyword = keyword.trim().toLowerCase();
    for (const [id, info] of Object.entries(db)) {
        if (info.title && info.title.toLowerCase().includes(cleanKeyword)) {
            return { id, ...info };
        }
    }
    return null;
}
export function hapusDoc(id) {
    const db = bacaDB();
    if (!db[id]) {
        console.log("[DB_INFO] Dokumen tidak ditemukan:", id)
        return false;
    }
    delete db[id];
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8")
        console.log("[DB_SUCCESS] Dokumen berhasil dihapus:", id)
        return true;
    } catch (error) {
        console.error("[DB_ERROR] Gagal menghapus dokumen:", error)
        return false;
    }
}
