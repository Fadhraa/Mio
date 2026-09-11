import fs from "fs";
import path from "path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { WORKSPACE_DIR } from "../../paths.js";
// Fungsi pembantu untuk menelusuri direktori secara rekursif
function listDirectoryRecursive(dirPath, indent = "") {
    let result = "";
    try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        items.forEach(item => {
            // Abaikan file/folder tersembunyi yang diawali tanda titik (.)
            if (item.name.startsWith(".")) return;

            const icon = item.isDirectory() ? "📁" : "📄";
            result += `${indent}${icon} ${item.name}\n`;

            // Jika objek adalah folder, telusuri isinya secara mendalam
            if (item.isDirectory()) {
                const childPath = path.join(dirPath, item.name);
                result += listDirectoryRecursive(childPath, indent + "    ");
            }
        });
    } catch (err) {
        result += `${indent}⚠️ Gagal membaca folder: ${err.message}\n`;
    }
    return result;
}

export const toolKelolaFileLokal = tool(async ({ aksi, tipe, nama, isi, pathTujuan, rekursif }) => {
    const baseDir = WORKSPACE_DIR;
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    const relativePath = pathTujuan || "";
    const targetName = nama || "";
    const absolutePath = path.join(baseDir, relativePath, targetName);
    const resolvedPath = path.resolve(absolutePath);

    // Proteksi Directory Traversal: Jangan biarkan mengakses di luar workspace
    if (!resolvedPath.startsWith(baseDir)) {
        return `Gagal: Aksi dibatalkan karena lokasi tujuan berada di luar direktori workspace HaloMio demi keamanan.`;
    }

    try {
        // --- AKSI: BUAT ---
        if (aksi === "buat") {
            if (!nama) return "Gagal: Parameter 'nama' wajib diisi untuk membuat file atau folder.";

            if (tipe === "folder") {
                if (fs.existsSync(resolvedPath)) {
                    const stats = fs.statSync(resolvedPath);
                    if (stats.isFile()) {
                        return `Gagal: Target "${nama}" sudah ada di disk tetapi merupakan sebuah file, bukan folder.`;
                    }
                    return `Folder "${nama}" sudah ada di lokasi "${relativePath || "./"}".`;
                }
                fs.mkdirSync(resolvedPath, { recursive: true });
                return `Sukses membuat folder baru "${nama}" di lokasi "${relativePath || "./"}".`;
            } else if (tipe === "file") {
                const parentDir = path.dirname(resolvedPath);
                if (fs.existsSync(resolvedPath)) {
                    const stats = fs.statSync(resolvedPath);
                    if (stats.isDirectory()) {
                        return `Gagal: Target "${nama}" sudah ada di disk tetapi merupakan sebuah folder/direktori, bukan file.`;
                    }
                }
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }

                const isOverwritten = fs.existsSync(resolvedPath);
                fs.writeFileSync(resolvedPath, isi || "", "utf-8");

                if (isOverwritten) {
                    return `Sukses menimpa (overwrite) file "${nama}" di lokasi "${relativePath || "./"}".`;
                } else {
                    return `Sukses membuat file baru "${nama}" di lokasi "${relativePath || "./"}".`;
                }
            }
        }

        // --- AKSI: BACA ---
        if (aksi === "baca") {
            if (!fs.existsSync(resolvedPath)) {
                return `Gagal: Target tidak ditemukan di lokasi "${relativePath || "./"}${targetName ? "/" + targetName : ""}".`;
            }

            const stats = fs.statSync(resolvedPath);

            if (tipe === "folder") {
                if (!stats.isDirectory()) {
                    return `Gagal: Target "${targetName}" bukan merupakan folder/direktori.`;
                }
                // pembacaan rekursif
                if (rekursif) {
                    const treeResult = listDirectoryRecursive(resolvedPath);
                    if (!treeResult) {
                        return `Folder "${targetName || "root"}" di lokasi "${relativePath || "./"}" kosong.`;
                    }
                    return `Struktur folder "${targetName || "root"}" di lokasi "${relativePath || "./"}" (Rekursif):\n\n${treeResult}`;
                }
                const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
                if (items.length === 0) {
                    return `Folder "${targetName || "root"}" kosong.`;
                }

                let result = `Daftar isi folder "${targetName || "root"}" di lokasi "${relativePath || "./"}":\n`;
                items.forEach(item => {
                    const icon = item.isDirectory() ? "📁" : "📄";
                    result += `${icon} ${item.name}\n`;
                });
                return result;
            }

            if (tipe === "file") {
                if (!stats.isFile()) {
                    return `Gagal: Target "${targetName}" bukan merupakan file berkas teks.`;
                }

                // Filter File Biner
                const BINARY_EXTENSIONS = [
                    // Gambar
                    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff",
                    // Dokumen Terkompresi / Arsip
                    ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2",
                    // Aplikasi / Kompilasi / Executables
                    ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".jar",
                    // Dokumen Kompleks (non-plain-text)
                    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
                    // Audio & Video
                    ".mp3", ".wav", ".ogg", ".flac", ".mp4", ".avi", ".mkv", ".mov",
                    // Database
                    ".db", ".sqlite", ".sqlite3"
                ];
                const ext = path.extname(resolvedPath).toLowerCase();
                if (BINARY_EXTENSIONS.includes(ext)) {
                    return `Gagal: Berkas "${targetName}" terdeteksi sebagai file biner (${ext}). Tool ini hanya diizinkan membaca file dokumen teks demi keamanan dan efisiensi token.`;
                }
                const content = fs.readFileSync(resolvedPath, "utf-8");
                return `Isi file "${targetName}" di lokasi "${relativePath || "./"}":\n\n${content}`;
            }
        }
        // --- AKSI: HAPUS ---
        if (aksi === "hapus") {
            if (!nama) return "Gagal: Parameter 'nama' wajib diisi untuk menghapus file atau folder.";
            if (!fs.existsSync(resolvedPath)) {
                return `Gagal: Target tidak ditemukan di lokasi "${relativePath || "./"}/${nama}".`;
            }

            const stats = fs.statSync(resolvedPath);

            if (tipe === "folder") {
                if (!stats.isDirectory()) {
                    return `Gagal: Target "${nama}" bukan merupakan folder/direktori.`;
                }
                // Menghapus folder beserta seluruh isinya secara rekursif
                fs.rmSync(resolvedPath, { recursive: true, force: true });
                return `Sukses menghapus folder "${nama}" beserta seluruh isinya di lokasi "${relativePath || "./"}".`;
            }

            if (tipe === "file") {
                if (!stats.isFile()) {
                    return `Gagal: Target "${nama}" bukan merupakan file berkas.`;
                }
                fs.unlinkSync(resolvedPath);
                return `Sukses menghapus file "${nama}" di lokasi "${relativePath || "./"}".`;
            }
        }
        return `Gagal: Aksi "${aksi}" dengan tipe "${tipe}" tidak didukung.`;
    } catch (error) {
        console.error("[File Manager Error]:", error);
        return `Gagal mengelola file/folder lokal: ${error.message}`;
    }
}, {
    name: "kelola_file_lokal",
    description: "Gunakan alat ini untuk MEMBUAT, MEMBACA, atau MENGHAPUS file teks dan folder secara lokal (terbatas di dalam sandbox folder 'mio_workspace'). Aksi 'buat' menulis file (menimpa jika sudah ada) atau membuat direktori. Aksi 'baca' membaca file/direktori. Aksi 'hapus' membuang berkas/direktori secara permanen.",
    schema: z.object({
        aksi: z.enum(["buat", "baca", "hapus"]).describe("Aksi yang ingin dijalankan: 'buat', 'baca', atau 'hapus'."),
        tipe: z.enum(["file", "folder"]).describe("Tipe objek: 'file' untuk berkas teks, 'folder' untuk direktori/folder."),
        nama: z.string().optional().describe("Nama berkas atau folder (contoh: 'index.html' atau 'src'). Kosongkan saat aksi 'baca' tipe 'folder' jika ingin membaca langsung folder di pathTujuan."),
        isi: z.string().optional().describe("Konten isi file teks (Hanya digunakan untuk aksi 'buat' dengan tipe 'file')."),
        pathTujuan: z.string().optional().describe("Path direktori relatif di dalam sandbox 'mio_workspace' (contoh: 'mio_website' atau 'catatan'). Kosongkan jika ingin mengakses langsung root folder 'mio_workspace'."),
        rekursif: z.boolean().optional().describe("Khusus aksi 'baca' tipe 'folder': Set 'true' jika ingin melihat seluruh isi subfolder di dalamnya secara rekursif.")
    })
});
