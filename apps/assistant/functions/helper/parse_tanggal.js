export const BULAN_INDO = {
  Januari: 0,
  Februari: 1,
  Maret: 2,
  April: 3,
  Mei: 4,
  Juni: 5,
  Juli: 6,
  Agustus: 7,
  September: 8,
  Oktober: 9,
  November: 10,
  Desember: 11,
};
export const HARI_INDO = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
export function parseTanggalIndo(tanggalStr, jamStr) {
  if (!tanggalStr) return null;
  const parts = tanggalStr.split(" ");
  if (parts.length !== 3) return null;

  const tgl = parseInt(parts[0]);
  const bulan = BULAN_INDO[parts[1]];
  const tahun = parseInt(parts[2]);
  if (isNaN(tgl) || bulan === undefined || isNaN(tahun)) return null;
  const jamParts = jamStr.split(":");
  const jam = parseInt(jamParts[0]) || 0;
  const menit = parseInt(jamParts[1]) || 0;
  return new Date(tahun, bulan, tgl, jam, menit, 0);
}
