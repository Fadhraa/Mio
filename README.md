# Mio - Continuous-Learning Personal AI Assistant & Behavioral Ecosystem

Mio adalah ekosistem asisten AI pribadi berbasis monorepo yang dirancang untuk **belajar mandiri memahami kebiasaan, preferensi, dan ritme kehidupan penggunanya secara berkelanjutan**, bukan sekadar chatbot pasif tanya-jawab. Mio mengamati percakapan dan log aktivitas layar harian untuk membangun profil perilaku yang adaptif, sambil tetap menjaga kedaulatan privasi data pengguna.

---

## Visi & Konsep: Asisten yang Terus Belajar

Berbeda dengan asisten AI konvensional yang hanya memiliki memori sesi yang cepat hilang, Mio mengadopsi konsep **Adaptive Long-Term Memory & Behavioral Learning**:

1. **Autonomous Fact Extraction (Observasi Latar Belakang)**:
   Setiap percakapan dievaluasi secara otomatis di background (observasi_percakapan.js) untuk mendeteksi fakta baru, preferensi, dan perubahan rutinitas tanpa pengguna harus mengisi formulir secara manual.
2. **Behavioral Logging & Habit Tracking**:
   Melalui integrasi desktop activity tracker, Mio mencatat pola penggunaan aplikasi, durasi fokus, dan ritme harian ke dalam database lokal (pps/tracking), memungkinkan asisten memahami konteks kerja pengguna.
3. **Multi-Agent Cognitive Specialization**:
   - **Mio (Core Mind)**: Bertindak sebagai koordinator percakapan utama yang empatik, kontekstual, dan memahami kepribadian pengguna.
   - **Nalomi (Personal & Habit Vault)**: Sub-agen spesialis yang mengelola fakta personal, kebiasaan berulang, dan jadwal harian.
   - **Miomi (Academic & Productivity Specialist)**: Sub-agen pendamping tugas akademik, manajemen dokumen, dan riset.
4. **Adaptive Context Injection**:
   Informasi kebiasaan dan fakta profil yang relevan secara dinamis disuntikkan ke dalam reasoning context saat percakapan berlangsung, sehingga respon Mio terasa personal, relevan, dan terus berkembang seiring waktu.

---

## Arsitektur Monorepo

```
Mio/
|-- apps/
|   |-- assistant/     # Express API daemon, LangChain multi-agent core, voice & WhatsApp integration
|   |-- tracking/      # Background desktop activity & window duration logger (SQLite)
|   |-- web/           # React + Tailwind CSS dashboard & interactive chat interface (Vite)
|-- .env.example       # Template konfigurasi environment terpadu
|-- package.json       # Root monorepo workspace configuration
-- LICENSE            # MIT License
```

---

## Fitur Utama

- **Continuous Personal Memory**: Pembelajaran aktif terhadap preferensi pengguna (kebiasaan harian, hobi, relasi, dan jadwal) yang tersimpan secara lokal dan terus diperbarui.
- **Desktop Activity Tracker**: Pelacak aktivitas jendela desktop secara otomatis yang terintegrasi ke SQLite untuk analisis fokus kerja dan kebiasaan digital.
- **Zero-Leakage PII Masking (Privacy Proxy)**: Memadukan kecerdasan model Cloud berkapasitas penalaran tinggi dengan sensor privasi dua arah (privacyMasker). Data pribadi (nama, relasi, fakta sensitif) disamarkan menjadi token anonim sebelum dikirim ke luar dan didekripsi kembali secara lokal sebelum ditampilkan ke pengguna.
- **Timing-Safe API Key Authentication**: Komunikasi antarmuka (CLI & Web UI) ke server backend dilindungi layer autentikasi kriptografi constant-time (crypto.timingSafeEqual) dan helmet security headers.
- **Decoupled Architecture**: Backend daemon dan Interactive CLI berjalan terpisah, memungkinkan server berjalan terus sebagai background service.
- **Privacy-First Storage**: Data pribadi, catatan memori, sesi WhatsApp, dan database tracking tidak diikutsertakan ke dalam repositori git secara default (.gitignore).

---

## Panduan Instalasi & Menjalankan

### 1. Prasyarat Sistem

- Node.js >= 18.0.0
- Python 3.10+ (opsional, untuk modul deteksi suara latar)
- [Ollama](https://ollama.com/) dengan model yang diperlukan (misal: gemma4:31b-cloud, qwen2.5:3b)

### 2. Klon Repositori & Instal Dependensi

```bash
git clone https://github.com/Fadhraa/Mio.git
cd Mio
npm install
```

### 3. Konfigurasi Environment Terpadu

Salin template .env.example ke root .env:

```bash
cp .env.example .env
```

Buka file .env dan sesuaikan nilainya:

- USER_NAME: Nama pengguna yang akan dipelajari dan disapa oleh Mio.
- MIO_API_KEY: Kunci otentikasi unik untuk mengamankan API (gunakan string acak berentropi tinggi).
- VITE_MIO_API_KEY: Samakan nilainya dengan MIO_API_KEY agar dashboard web otomatis terhubung.
- Konfigurasi model AI (GEMINI_API_KEY, NVIDIA_API_KEY, dsb).

### 4. Menjalankan Aplikasi

#### Menjalankan Seluruh Ekosistem (Backend Server + Web UI):

```bash
npm run dev
```

- Web Dashboard: http://localhost:5173
- Backend API: http://localhost:3000

#### Menjalankan Interactive CLI Client:

Buka terminal baru saat server sedang berjalan:

```bash
npm run cli
```

---

## Pengujian Keamanan & Integritas

Repositori ini dilengkapi rangkaian tes otomatis:

```bash
# Uji keamanan API Key & Server Hardening
npm test --workspace=assistant

# Uji konfigurasi single root .env
node apps/assistant/tests/test_env_config.js

# Uji pembacaan memori lokal
node apps/assistant/tests/test_memory.js

# Uji sensor data pribadi dua arah (Zero-Leakage PII Masking)
node apps/assistant/tests/test_privacy_masker.js
```

---

## Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
