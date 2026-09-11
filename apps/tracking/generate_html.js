const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'sql', 'activity.sqlite');
const htmlPath = path.join(__dirname, 'viewer.html');

function generateHtml() {
    return new Promise((resolve, reject) => {
        // Pastikan database ada
        if (!fs.existsSync(dbPath)) {
            return reject(new Error("Database tidak ditemukan di " + dbPath));
        }

        const db = new sqlite3.Database(dbPath);
        console.log("Mengambil data dari database untuk HTML...");

        db.all(`SELECT * FROM sessions ORDER BY id DESC`, [], (err, sessionRows) => {
            if (err) {
                db.close();
                return reject(err);
            }

            db.all(`SELECT * FROM learned_categories ORDER BY id DESC`, [], (err, learnedRows) => {
                if (err) {
                    db.close();
                    return reject(err);
                }

                db.close();

                // Bangun struktur HTML mentah dengan tombol aksi hapus
                let htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualisasi Aktivitas & Memori AI</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --surface-color: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --border: #334155;
            --accent: #10b981;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 40px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        h2 {
            margin-top: 60px;
            font-size: 1.8rem;
            color: var(--text-main);
            border-left: 4px solid var(--primary);
            padding-left: 12px;
        }
        p.subtitle {
            text-align: center;
            color: var(--text-muted);
            margin-bottom: 40px;
        }
        .header-actions {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-bottom: 30px;
        }
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-danger {
            background-color: #f38ba8;
            color: #11111b;
        }
        .btn-danger:hover {
            background-color: #f7a8b8;
            box-shadow: 0 4px 15px rgba(243, 139, 168, 0.4);
            transform: translateY(-2px);
        }
        .btn-warning {
            background-color: #f9e2af;
            color: #11111b;
        }
        .btn-warning:hover {
            background-color: #faebd7;
            box-shadow: 0 4px 15px rgba(249, 226, 175, 0.4);
            transform: translateY(-2px);
        }
        .btn-delete {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: bold;
            background-color: rgba(243, 139, 168, 0.15);
            color: #f38ba8;
            border: 1px solid rgba(243, 139, 168, 0.3);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-delete:hover {
            background-color: #f38ba8;
            color: #11111b;
            box-shadow: 0 2px 8px rgba(243, 139, 168, 0.3);
        }
        .table-container {
            background-color: var(--surface-color);
            border-radius: 12px;
            padding: 1px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            overflow-x: auto;
            border: 1px solid var(--border);
            margin-bottom: 40px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }
        th, td {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
        }
        th {
            background-color: rgba(0, 0, 0, 0.2);
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 0.05em;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background-color: rgba(255, 255, 255, 0.03);
        }
        .tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            background-color: rgba(59, 130, 246, 0.2);
            color: #93c5fd;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .tag-learned {
            background-color: rgba(16, 185, 129, 0.2);
            color: #6ee7b7;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .summary-cell {
            max-width: 400px;
            line-height: 1.5;
            color: #cbd5e1;
        }
        .time-badge {
            color: #cbd5e1;
            font-family: monospace;
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 4px;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Dashboard HaloMio</h1>
        <p class="subtitle">Visualisasi Riwayat Aktivitas & Memori AI</p>

        <!-- Tombol Aksi Massal -->
        <div class="header-actions">
            <button class="btn btn-danger" onclick="clearAllSessions()">🗑️ Hapus Semua Riwayat</button>
            <button class="btn btn-warning" onclick="clearAllLearned()">🧠 Reset Memori AI</button>
        </div>
        
        <h2>📅 Riwayat Aktivitas Harian</h2>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Kategori</th>
                        <th>Waktu</th>
                        <th>Durasi (Detik)</th>
                        <th>Aplikasi / Konteks</th>
                        <th>Rangkuman AI</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

                if (sessionRows.length === 0) {
                    htmlContent += `<tr><td colspan="7" class="empty-state">Belum ada sesi aktivitas yang direkam.</td></tr>`;
                } else {
                    sessionRows.forEach(row => {
                        let appsList = "[]";
                        try {
                            const parsedApps = JSON.parse(row.apps_used);
                            appsList = Array.isArray(parsedApps) ? parsedApps.join(", ") : row.apps_used;
                        } catch(e) {
                            appsList = row.apps_used || "-";
                        }

                        htmlContent += `
                            <tr>
                                <td style="color: var(--text-muted)">#${row.id}</td>
                                <td><span class="tag">${row.category}</span></td>
                                <td>
                                    <div>${row.day_of_week}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                                        Jam <span class="time-badge">${row.hour_of_day}:00</span> (Start: ${row.start_time})
                                    </div>
                                </td>
                                <td style="font-weight: 600; color: #f8fafc;">${row.total_duration_seconds}s</td>
                                <td style="font-size: 0.9rem; color: #94a3b8;">${appsList}</td>
                                <td class="summary-cell">${row.summary}</td>
                                <td>
                                    <button class="btn-delete" onclick="deleteSession(${row.id})">Hapus</button>
                                </td>
                            </tr>
                        `;
                    });
                }

                htmlContent += `
                </tbody>
            </table>
        </div>

        <h2>🧠 Memori Kategori AI (Auto-Learn)</h2>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nama Aplikasi (App Name)</th>
                        <th>Kategori Hasil Belajar</th>
                        <th>Waktu Dipelajari</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

                if (learnedRows.length === 0) {
                    htmlContent += `<tr><td colspan="5" class="empty-state">AI belum mempelajari pemetaan kategori baru. (Aplikasi yang belum dikenal masih ditandai "LAINNYA").</td></tr>`;
                } else {
                    learnedRows.forEach(row => {
                        htmlContent += `
                            <tr>
                                <td style="color: var(--text-muted)">#${row.id}</td>
                                <td style="font-weight: 600; color: #f8fafc;">${row.app_name}</td>
                                <td><span class="tag tag-learned">${row.category}</span></td>
                                <td style="font-size: 0.9rem; color: #94a3b8;">${row.created_at}</td>
                                <td>
                                    <button class="btn-delete" onclick="deleteLearned(${row.id})">Hapus</button>
                                </td>
                            </tr>
                        `;
                    });
                }

                htmlContent += `
                </tbody>
            </table>
        </div>
    </div>

    <!-- Script Client-Side untuk Hapus Data -->
    <script>
        const API_URL = 'http://localhost:5005';

        async function sendDelete(endpoint, body, msg) {
            if (!confirm(msg || 'Apakah Anda yakin ingin menghapus data ini?')) return;
            try {
                const res = await fetch(\`\${API_URL}/api/\${endpoint}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    window.location.reload();
                } else {
                    const errMsg = await res.text();
                    alert('Gagal menghapus data: ' + errMsg);
                }
            } catch (err) {
                alert('Gagal menghubungkan ke Tracker. Pastikan program track.js sedang berjalan di latar belakang!');
            }
        }

        function deleteSession(id) {
            sendDelete('delete-session', { id }, 'Hapus riwayat aktivitas ini?');
        }

        function deleteLearned(id) {
            sendDelete('delete-learned', { id }, 'Apakah Anda ingin melupakan kategori hasil belajar AI untuk aplikasi ini?');
        }

        function clearAllSessions() {
            sendDelete('clear-sessions', {}, 'PERINGATAN! Ini akan menghapus seluruh data riwayat aktivitas Anda secara permanen. Lanjutkan?');
        }

        function clearAllLearned() {
            sendDelete('clear-learned', {}, 'Ini akan mereset seluruh memori belajar AI. Lanjutkan?');
        }
    </script>
</body>
</html>
                `;

                fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
                console.log("✅ Berhasil! File HTML telah diperbarui di:", htmlPath);
                resolve();
            });
        });
    });
}

// Jalankan langsung jika dipanggil lewat CLI (node generate_html.js)
if (require.main === module) {
    generateHtml().catch(err => {
        console.error("Gagal menjalankan generate_html:", err);
        process.exit(1);
    });
}

module.exports = { generateHtml };
