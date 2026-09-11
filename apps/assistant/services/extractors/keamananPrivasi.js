const KATA_KUNCI_SENSITIF = [
  "password",
  "kata sandi",
  "pin bank",
  "otp",
  "token auth",
  "nomor rekening",
  "no rekening",
  "kartu kredit",
  "cvv",
  "ktp",
  "nik",
];

const REGEX_PII = /\b\d{16}\b|\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/i;

export function periksaKeamanan(teks) {
  if (!teks) return { isSensitive: false, alasan: null };

  const lowerTeks = teks.toLowerCase();
  // Periksa kata kunci sensitif dengan batasan kata (word boundary) agar tidak salah deteksi pada kata seperti "Politeknik" atau "Teknik"
  const kata_kunci = KATA_KUNCI_SENSITIF.some((kunci) => {
    if (kunci.length <= 4) {
      const regexKata = new RegExp(`\\b${kunci}\\b`, "i");
      return regexKata.test(lowerTeks);
    }
    return lowerTeks.includes(kunci);
  });
  if (kata_kunci) {
    return {
      isSensitive: true,
      alasan: "Mengandung kata kunci sensitif",
    };
  }

  // pola nomor kartu kredit
  const cocokNoKartu = teks.match(REGEX_PII);
  if (cocokNoKartu) {
    return {
      isSensitive: true,
      alasan: "Terdeteksi pola nomor identitas/kartu 16-digit (PII)",
    };
  }

  return {
    isSensitive: false,
    alasan: null,
  };
}
