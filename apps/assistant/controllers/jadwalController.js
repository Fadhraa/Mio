import { getJadwalHariIni, getJadwalMingguan } from "../services/jadwalService.js";

/**
 * Controller endpoint HTTP untuk /api/jadwal
 */
export function ambilJadwal(req, res) {
  try {
    const filter = req.query.filter;
    if (filter === "mingguan") {
      const hasilMingguan = getJadwalMingguan();
      return res.json(hasilMingguan);
    } else {
      const hasilHariIni = getJadwalHariIni();
      return res.json(hasilHariIni);
    }
  } catch (error) {
    console.error("[ERROR CONTROLLER AMBIL JADWAL]:", error);
    return res.status(500).json({ error: "Gagal memproses data jadwal" });
  }
}

