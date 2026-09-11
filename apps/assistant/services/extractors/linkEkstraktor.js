const REGEX_URL_GLOBAL = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|edu|gov|id|net|co|io)\/[^\s]*/gi;

/**
 * Ekstraksi URL unik dari teks pesan
 */
export function ekstrakUrldariTeks(teks) {
  if (!teks) return [];
  const matches = teks.match(REGEX_URL_GLOBAL);
  if (!matches) return [];

  const uniqueUrls = new Set();
  const result = [];

  for (let rawUrl of matches) {
    let cleanUrl = rawUrl.replace(/[>\]\),.]+$/, ""); // Hapus tanda kurung / titik di ujung
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }

    const lower = cleanUrl.toLowerCase();
    if (!uniqueUrls.has(lower)) {
      uniqueUrls.add(lower);
      result.push(cleanUrl);
    }
  }

  return result;
}

/**
 * Ekstraksi URL unik beserta label teks di baris sebelumnya sebagai konteks nama link
 */
export function ekstrakUrlDanKonteks(teks) {
  if (!teks) return [];
  const barisList = teks.split("\n").map((b) => b.trim());
  const hasil = [];
  const urlTerlihat = new Set();

  for (let i = 0; i < barisList.length; i++) {
    const baris = barisList[i];
    const matches = baris.match(REGEX_URL_GLOBAL);
    if (matches) {
      for (let rawUrl of matches) {
        let cleanUrl = rawUrl.replace(/[>\]\),.]+$/, "");
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
          cleanUrl = "https://" + cleanUrl;
        }

        const lower = cleanUrl.toLowerCase();
        if (!urlTerlihat.has(lower)) {
          urlTerlihat.add(lower);

          // Cek baris sebelumnya sebagai potensi label judul
          let labelKonteks = "";
          if (i > 0 && !barisList[i - 1].match(REGEX_URL_GLOBAL)) {
            labelKonteks = barisList[i - 1]
              .replace(/^[>:\-\s*#]+|[:\-\s*#]+$/g, "")
              .trim();
          }

          hasil.push({
            url: cleanUrl,
            labelKonteks: labelKonteks || null,
          });
        }
      }
    }
  }

  return hasil;
}

export async function ambilDataWeb(url) {
  try {
    const controller = new AbortController();
    const timeOut = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeOut);
    const html = await response.text();
    const matchTitle =
      html.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      ) || html.match(/<title>([^<]+)<\/title>/i);
    const matchDesc =
      html.match(
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      );
    const judul = matchTitle ? matchTitle[1].trim() : "Tautan Web";
    const deskripsi = matchDesc ? matchDesc[1].trim() : "Tidak ada deskripsi.";
    
    let kategori = "referensi";
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("instagram.com")) kategori = "lomba";
    else if (lowerUrl.includes("canva.com")) kategori = "canva";
    else if (lowerUrl.includes("drive.google.com") || lowerUrl.includes("docs.google.com")) kategori = "dokumen";
    else {
      kategori = "lainnya";
    }

    return {
      judul,
      deskripsi,
      kategori,
      url,
    };
  } catch (e) {
    let kategoriFallback = "referensi";
    if (url.includes("drive.google.com") || url.includes("docs.google.com")) kategoriFallback = "dokumen";
    return {
      url,
      judul: "Tautan Web",
      deskripsi: "Gagal mengambil metadata web otomatis.",
      kategori: kategoriFallback,
    };
  }
}
