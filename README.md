# Mio - Self-Hosted Personal AI Assistant & Productivity Ecosystem

Mio adalah ekosistem asisten AI pribadi berbasis monorepo yang dirancang untuk membantu produktivitas harian, manajemen tugas akademik, pelacakan aktivitas layar otomatis, dan interaksi cerdas melalui web interface maupun CLI.

---

## Arsitektur Monorepo

Mio/
├── apps/
│ ├── assistant/ # Express API daemon, LangChain multi-agent core, WhatsApp & voice integration
│ ├── tracking/ # Background desktop & window activity logger (SQLite)
│ └── web/ # React + Tailwind CSS dashboard & chat interface (Vite)
├── .env.example # Template konfigurasi environment terpadu
├── package.json # Root monorepo workspace configuration
└── LICENSE # MIT License

---

## Fitur Utama

- **Multi-Agent Orchestration**: Agen utama (Mio) didukung sub-agen spesialisasi:
  - **Miomi**: Manajemen tugas akademik & Google Docs.
  - **Nalomi**: Manajemen memori personal, kebiasaan berulang, dan jadwal harian.
- **Timing-Safe API Key Authentication**: Komunikasi antarmuka (CLI & Web UI) ke server backend dilindungi layer autentikasi kriptografi constant-time (crypto.timingSafeEqual) dan helmet security headers.
- **Decoupled Architecture**: Backend daemon dan Interactive CLI berjalan terpisah, memungkinkan server berjalan terus sebagai background service.
- **Privacy First**: Data pribadi, catatan memori, sesi WhatsApp, dan database tracking tidak diikutsertakan ke dalam repositori git secara default (.gitignore).
- **Activity Tracker**: Pencatatan aktivitas aplikasi desktop secara otomatis dengan integrasi rangkuman AI.

---

## Panduan Instalasi & Menjalankan

### 1. Prasyarat Sistem

- Node.js >= 18.0.0
- Python 3.10+ (opsional, untuk modul deteksi suara)
- [Ollama](https://ollama.com/) dengan model yang diperlukan (misal: gemma4:31b-cloud, minimax-m2.5:cloud)

### 2. Klon Repositori & Instal Dependensi

```
bash
git clone https://github.com/Fadhraa/Mio.git
cd Mio
npm install
```

### 3. Konfigurasi Environment Terpadu

Salin template .env.example ke root .env:
`ash
cp .env.example .env
`
Buka file .env dan sesuaikan nilainya:

- USER_NAME: Nama pengguna yang akan disapa oleh Mio.
- MIO_API_KEY: Kunci otentikasi unik untuk mengamankan API (gunakan string acak panjang).
- VITE_MIO_API_KEY: Samakan nilainya dengan MIO_API_KEY agar dashboard web otomatis terhubung.
- Konfigurasi model AI (GEMINI_API_KEY, NVIDIA_API_KEY, dll).

### 4. Menjalankan Aplikasi

#### Menjalankan Seluruh Ekosistem (Backend Server + Web UI):

`ash
npm run dev
`

- Web Dashboard: http://localhost:5173
- Backend API: http://localhost:3000

#### Menjalankan Interactive CLI Client:

Buka terminal baru saat server sedang berjalan:
`ash
npm run cli
`

---

## Pengujian Keamanan & Integritas

Repositori ini dilengkapi rangkaian tes otomatis:
`ash

# Uji keamanan API Key & Server Hardening

npm test --workspace=assistant

# Uji konfigurasi single root .env

node apps/assistant/tests/test_env_config.js

# Uji pembacaan memori lokal

node apps/assistant/tests/test_memory.js
`

---

## Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
