import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, CheckCircle, AlertCircle, Plus, Search, Filter } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function Jadwal() {
    const [filterFrekuensi, setFilterFrekuensi] = useState('semua'); // 'semua' | 'harian' | 'mingguan' | 'sekali_saja'
    const [filterKategori, setFilterKategori] = useState('semua'); // 'semua' | 'kuliah' | 'rutinitas' | 'kegiatan'
    const [dataJadwal, setDataJadwal] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const ambilSemuaJadwal = async () => {
        try {
            setIsLoading(true);
            const res = await apiFetch('/api/jadwal?filter=mingguan');
            const data = await res.json();
            setDataJadwal(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Gagal memuat jadwal mingguan:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        ambilSemuaJadwal();
    }, []);

    // Filter jadwal items across the week groups
    const dataFiltered = dataJadwal.map(dayGroup => {
        const items = (dayGroup.items || []).filter(item => {
            const matchSearch = (item.judul || item.kegiatan || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (item.dosen || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (item.ruangan || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchKategori = filterKategori === 'semua' || (item.kategori || 'rutinitas') === filterKategori;
            const matchFrekuensi = filterFrekuensi === 'semua' || item.frekuensi === filterFrekuensi;

            return matchSearch && matchKategori && matchFrekuensi;
        });

        return {
            ...dayGroup,
            items
        };
    });

    const totalKegiatan = dataFiltered.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="space-y-6">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-blue-600" />
                        Jadwal & Agenda
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Kelola dan tinjau agenda kuliah, kegiatan, dan rutinitas harian Anda.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {totalKegiatan} Agenda Terjadwal
                    </span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Cari mata kuliah, dosen, ruang..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-700"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">Kategori:</span>
                    </div>
                    {['semua', 'kuliah', 'rutinitas', 'kegiatan'].map((kat) => (
                        <button
                            key={kat}
                            onClick={() => setFilterKategori(kat)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-colors ${
                                filterKategori === kat
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {kat}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Agenda per Hari */}
            {isLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                    Memuat agenda jadwal...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dataFiltered.map((dayGroup) => (
                        <div
                            key={dayGroup.tanggal}
                            className={`border rounded-2xl p-4 transition-all ${
                                dayGroup.is_hari_ini
                                    ? 'bg-blue-50/40 border-blue-300 shadow-sm'
                                    : 'bg-white/70 border-slate-200/70 hover:border-slate-300'
                            }`}
                        >
                            {/* Day Header */}
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60">
                                <div>
                                    <h3 className={`font-bold text-sm ${dayGroup.is_hari_ini ? 'text-blue-700' : 'text-slate-800'}`}>
                                        {dayGroup.hari}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">{dayGroup.tanggal}</p>
                                </div>
                                {dayGroup.is_hari_ini && (
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                                        Hari Ini
                                    </span>
                                )}
                            </div>

                            {/* Item list */}
                            <div className="space-y-2.5">
                                {dayGroup.items.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">Tidak ada jadwal</p>
                                ) : (
                                    dayGroup.items.map((item) => {
                                        const jamMulai = item.jam_mulai || item.jam || '00:00';
                                        const jamSelesai = item.jam_selesai;
                                        const judul = item.judul || item.kegiatan || 'Tanpa Judul';
                                        const kategori = item.kategori || 'rutinitas';

                                        let tagColor = 'bg-slate-100 text-slate-700';
                                        if (kategori === 'kuliah') tagColor = 'bg-blue-100 text-blue-700';
                                        if (kategori === 'kegiatan') tagColor = 'bg-amber-100 text-amber-700';
                                        if (kategori === 'rutinitas') tagColor = 'bg-purple-100 text-purple-700';

                                        return (
                                            <div
                                                key={item.id}
                                                className={`p-3 rounded-xl border transition-all ${
                                                    item.status === 'active'
                                                        ? 'bg-emerald-50 border-emerald-300'
                                                        : item.status === 'completed' && dayGroup.is_hari_ini
                                                        ? 'bg-slate-50/70 border-slate-200/50 opacity-60'
                                                        : 'bg-white border-slate-200/80 shadow-xs'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        {jamMulai} {jamSelesai ? `- ${jamSelesai}` : ''}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${tagColor}`}>
                                                        {kategori}
                                                    </span>
                                                </div>

                                                <h4 className={`text-sm font-semibold ${
                                                    item.status === 'completed' && dayGroup.is_hari_ini
                                                        ? 'line-through text-slate-400'
                                                        : 'text-slate-800'
                                                }`}>
                                                    {judul}
                                                </h4>

                                                {item.ruangan && (
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Ruang: <strong className="text-slate-700 font-mono">{item.ruangan}</strong>
                                                    </p>
                                                )}

                                                {item.dosen && (
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Dosen: <span className="text-slate-700 font-medium">{item.dosen}</span>
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}