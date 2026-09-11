# Ringkasan Proyek: HaloMio Monorepo

Dokumen ini adalah konteks teknis lengkap proyek **HaloMio** untuk digunakan sebagai referensi acuan dalam sesi pengembangan baru.

---

## 1. Ikhtisar & Lokasi Proyek
* **Lokasi Root**: `D:\coding\Mio`
* **Arsitektur**: Monorepo berbasis **NPM Workspaces** (`apps/*`) dan Single Python Virtual Environment (`.venv`).
* **Tujuan**: Asisten AI pribadi terintegrasi dengan antarmuka Web Dashboard, sinkronisasi WhatsApp (Baileys), input suara latar belakang (Python), pelacak aktivitas desktop, serta basis data SQLite Vault.

---

## 2. Struktur Direktori Monorepo

```text
D:\coding\Mio/
├── package.json          # Root Monorepo configuration (NPM Workspaces)
├── package-lock.json     # Single lockfile terpusat
├── requirements.txt      # Dependensi Python terpusat (SpeechRecognition, PyAudio)
├── .gitignore            # Filter global: node_modules/, .venv/, database/, .env, memory/
├── run_mio.bat           # Launcher terpadu 1-klik (menjalankan npm run dev)
├── node_modules/         # SINGLE hoisted node_modules untuk semua apps
├── .venv/                # SINGLE Python Virtual Environment terpusat
└── apps/
    ├── assistant/        # Backend Core, AI Multi-Agent, Express API, & WA Baileys
    ├── web/              # Frontend React 18 + Vite 5 + Tailwind CSS v4
    └── tracking/         # Activity Tracker Daemon (active window & idle monitoring)
```

---

## 3. Rincian Modul & Komponen Utama

### A. Backend AI & Services (`apps/assistant`)
* **Entry Point**: `app.js` (memulai Express Server, inisialisasi WhatsApp, spawn `telinga.py` via root `.venv`, dan spawn tracker).
* **Server HTTP**: `server.js` (Express pada port 3000):
  * `POST /api/chat`: Chat interface dengan dukungan analisis gambar Base64 via Gemini Vision (`gemini-3.5-flash`).
  * `GET /api/jadwal`: Jadwal harian / mingguan dengan status dinamis.
  * `GET /api/dashboard/briefing`: AI Briefing harian menggunakan Ollama lokal dengan in-memory cache TTL 15 menit.
* **Arsitektur Agen AI (`agent.js`)**:
  * Menggunakan LangChain Tool Calling.
  * Model Brain Utama: Ollama (`gemma4:31b-cloud` / model lokal).
  * Sub-Agen Spesialis:
    * `Miomi` (`functions/akademik/miomi.js`): Tugas akademik dan Google Docs.
    * `Nalomi` (`functions/personal/nalomi.js`): Jadwal, agenda, dan data personal.
  * Background Observer: `observasi_percakapan.js` untuk merekam fakta dan kebiasaan.
* **Service Layer**:
  * `jadwalService.js`: Modul terpusat pengelola jadwal dengan **in-memory cache** (mengeliminasi *disk I/O churn*). Menghitung status dinamis (`active`, `completed`, `pending`), auto-arsip jadwal `sekali_saja`, dan menyuplai data untuk controller maupun briefing engine.
  * `waService.js`: WhatsApp integration via `@whiskeysockets/baileys`.
    * Mode Online: Balas kutipan instan.
    * Mode Offline Catch-Up: Menampung pesan masuk ke antrean buffer (`rekapOffline`) dengan jeda debounce 3.5 detik untuk menghasilkan 1 pesan rekapitulasi ringkas (*digest*).
    * Auto-cleanup pesan duplikat (menghapus pesan tanpa jejak setelah 5 detik).
  * `briefingService.js`: Menghasilkan sapaan cerdas berkala berdasarkan jadwal hari ini dan waktu sekarang (pagi, siang, sore, malam).
  * **Extractors**:
    * `announcementEkstraktor.js`: Menjaga broadcast pengumuman panjang tetap utuh sebagai satu dokumen dengan metadata tautan.
    * `imageEkstraktor.js`: Unduh media WhatsApp, ekstraksi hash SHA-256 (O(1) duplicate check di SQLite), simpan lokal, dan OCR/deskripsi via Gemini Vision.
    * `linkEkstraktor.js`: Ekstraksi URL unik, deduplikasi in-message, dan penangkapan label konteks.
    * `keamananPrivasi.js`: Guardrail privasi menggunakan regex word boundary (`\bnik\b`, pin ATM, dll.) untuk mencegah pengiriman data sensitif ke cloud AI.
* **Security & Auth Layer**:
  * `authMiddleware.js`: Sistem proteksi API Key terpusat dengan perbandingan *constant-time* (`crypto.timingSafeEqual` + SHA-256 hash) untuk mencegah *timing attacks*. Mendukung header `Authorization: Bearer <KEY>`, `x-api-key`, dan query param `key`.
  * `helmet`: Proteksi HTTP security headers (menonaktifkan kebocoran `X-Powered-By`, mitigasi XSS/sniffing).
  * `cors`: Pembatasan origin dinamis berbasis variabel lingkungan `CORS_ORIGIN`.
  * `GET /api/auth/verify`: Endpoint verifikasi status kunci akses klien.

### B. Frontend Dashboard (`apps/web`)
* **Tech Stack**: React 18, Vite 5, Tailwind CSS v4, Lucide Icons.
* **Security & API Client**:
  * `services/api.js`: Klien API terpusat (`apiFetch`) yang otomatis menyertakan Bearer Token, sinkronisasi token lintas komponen via Custom Events, dan interceptor error 401 Unauthorized.
  * `components/AuthModal.jsx`: Modal otentikasi ramah privasi untuk memasukkan, memverifikasi, dan menghapus API Key dari penyimpanan lokal browser.
* **Halaman Utama (`Dashboard.jsx`)**:
  * Live Clock Indonesia.
  * Header AI Briefing dengan skeleton loader dan fallback cerdas.
  * Tab Jadwal Interaktif: Mode "Hari Ini" dan mode "Mingguan" (7 hari ke depan terkelompok per hari).
  * Visual indicators: Indikator status aktif (pulsing radar), coret untuk jadwal selesai, tag kategori (`kuliah`, `rutinitas`, `kegiatan`), ruang kelas, dan dosen pengampu.

### C. Desktop Tracker (`apps/tracking`)
* **Entry Point**: `track.js` (mendeteksi jendela aktif dan waktu idle pengguna).
* **Penyimpanan**: SQLite `sql/activity.sqlite`.

---

## 4. Cara Menjalankan Monorepo

Seluruh perintah dijalankan dari root direktori `D:\coding\Mio`:

```bash
# Menjalankan Backend + Frontend bersamaan
npm run dev

# Menjalankan per modul
npm run dev:assistant   # Menjalankan backend AI, Express, dan WA
npm run dev:web         # Menjalankan server dev Vite (port 5173)
npm run dev:tracking    # Menjalankan background tracker

# Build frontend untuk produksi
npm run build:web

# Menjalankan uji integrasi keamanan API Key
npm test --workspace=assistant

# Inisialisasi ulang Python Virtual Environment
npm run setup:python
```

---

## 5. Status Terakhir & Pekerjaan Mendatang (Roadmap)

### Yang Baru Saja Diselesaikan:
1. **Pondasi Keamanan & API Key Komunikasi Antar-Aplikasi**:
   - Pemasangan `authMiddleware.js` dengan proteksi timing attack SHA-256.
   - Pemasangan `helmet` dan konfigurasi `cors` restriktif di backend.
   - Seluruh endpoint `/api/*` terkunci secara *default* (Secure by Default).
   - Pembuatan modul klien `apiFetch` dan komponen `AuthModal` di frontend dashboard.
   - Penyediaan template `.env.example` di root dan `apps/assistant`.
   - Pembuatan rangkaian automated test keamanan (`tests/test_server_security.js`) yang lolos 100%.

### Prioritas Tahap Berikutnya:
1. **Eliminasi Kebocoran Privasi Suara**: Mengganti `recognize_google` di `telinga.py` dengan model wake-word dan transkripsi lokal (*on-device*).
2. **Pemisahan Satelit Desktop (Decoupling)**: Memisahkan modul suara dan tracker ke dalam `apps/satellite` mandiri.
3. **Abstraksi Konfigurasi Persona**: Menghapus data hardcoded nama ("Fadhra", "Dania") dari basis kode.

