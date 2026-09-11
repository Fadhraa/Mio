import React, { useState, useEffect, useRef } from 'react';
import {
    Cpu, Brain, Clock, FileText, Search, Send, X, LayoutDashboard, Home, Calendar, BookOpen, Settings, MessageSquare, Bot,
    Sparkles
} from 'lucide-react';
import { apiFetch } from '../services/api';


export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [briefingText, setBriefingText] = useState("memuat briefing...");
    const [isBriefingLoading, setIsBriefingLoading] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [jadwal, setJadwal] = useState('hari ini');
    const [daftarJadwal, setDaftarJadwal] = useState([]);
    const [error, setError] = useState(null);
    const chatWindowRef = useRef(null);
    const fileInputRef = useRef(null);

    // Live Clock
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('id-ID'));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);
    // Ambil jadwal
    useEffect(() => {
        const ambilJadwal = async (showLoading = false) => {
            try {
                if (showLoading) setIsLoading(true);
                const endpoint = jadwal === 'hari ini' ? '/api/jadwal' : '/api/jadwal?filter=mingguan';
                const res = await apiFetch(endpoint);
                const data = await res.json()
                if (data.error) {
                    setError(data.error)
                } else {
                    setDaftarJadwal(data)
                    console.log(data)

                }
            } catch (e) {
                console.error("gagal mengambil jadwal", e)
            }
            finally {
                if (showLoading) setIsLoading(false)
            }

        }
        ambilJadwal(true);
        const intervalGetJadwal = setInterval(() => {
            ambilJadwal(false)
        }, 3000);
        return () => clearInterval(intervalGetJadwal)
    }, [jadwal])
    // ambil briefing
    useEffect(() => {
        const ambilBriefing = async () => {
            try {
                setIsBriefingLoading(true);
                const res = await apiFetch('/api/dashboard/briefing');
                const data = await res.json();
                if (data.briefing) {
                    setBriefingText(data.briefing);
                } else if (data.error) {
                    setBriefingText("Semoga harimu menyenangkan dan produktif!");
                }
            } catch (e) {
                console.error("Gagal mengambil briefing:", e);
                setBriefingText("Semoga harimu menyenangkan dan produktif!");
            } finally {
                setIsBriefingLoading(false);
            }
        };
        ambilBriefing();
    }, []);
    const isDataGrouped = daftarJadwal.length > 0 && typeof daftarJadwal[0] === 'object' && 'items' in daftarJadwal[0];

    return (
        <div>

            {/* welcome section */}
            <section className='mb-12'>
                <div className='flex flex-col md:flex-row md:items-center md:justify-between'>
                    <div className='w-156 flex gap-4 flex-col'>
                        <h1 className='text-headline-lg text-[48px] font-headline-lg text-gray-800'>Selamat Pagi, Fadhra</h1>
                        {/* rangkuman Ai */}
                       <div className="min-h-[48px]">
    {isBriefingLoading ? (
        <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        </div>
    ) : (
        <p className="text-base text-slate-600 leading-relaxed transition-opacity duration-300">
            {briefingText}
        </p>
    )}
</div>
                    </div>
                    <div className='relative w-96 h-36 p-1 bg-white shadow-[0_8px_40px_10px_rgba(255,107,53,0.2)] rounded-xl '>
                        <img className='rounded-xl w-full h-full object-cover object-[center_20%]' src="/Dania_bajuhitam.jpeg" alt="" />
                        <div className='absolute left-[-15px] bottom-[-15px] bg-white rounded-xl p-1 font-satisfy animate-bounce'>❤️ Ma bee</div>
                    </div>

                </div>
            </section>
            {/* Grid layoutin */}
            <div className='w-full grid grid-cols-5 grid-rows-5  gap-gutter'>
                <div className='col-span-3 row-span-4 bg-white/30 rounded-3xl shadow-lg p-container-padding'>
                    {isLoading && <p className="text-center">Memuat jadwal...</p>}

                    {!isLoading &&
                        // header container
                        <div>
                            <div className='flex justify-between'>
                                <h2 className='font-headline-md text-headline-md font-bold text-on-surface'>Jadwal {jadwal}</h2>
                                <div className='relative flex bg-secondary/5 border border-outline-variant/20 p-1 rounded-full w-fit select-none'>
                                    {/* Sliding active pill indicator */}
                                    <div
                                        className={`absolute top-1 bottom-1 left-1 bg-gradient-to-r from-secondary to-tertiary rounded-full transition-all duration-300 ease-in-out ${
                                            jadwal === 'hari ini' ? 'w-24 translate-x-0' : 'w-28 translate-x-24'
                                        }`}
                                    />
                                    
                                    <button 
                                        onClick={() => setJadwal("hari ini")}
                                        className={`relative z-10 w-24 py-2 font-label-md text-xs font-bold rounded-full transition-colors duration-300 cursor-pointer ${
                                            jadwal === 'hari ini' ? 'text-white' : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        Hari ini
                                    </button>
                                    
                                    <button 
                                        onClick={() => setJadwal("mingguan")}
                                        className={`relative z-10 w-28 py-2 font-label-md text-xs font-bold rounded-full transition-colors duration-300 cursor-pointer ${
                                            jadwal === 'mingguan' ? 'text-white' : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        Mingguan
                                    </button>
                                </div>
                            </div>
                            {/* card card jadwal */}
                            {jadwal === 'hari ini' && !isDataGrouped && (
                                <div className='flex items-center gap-4 my-4'>
                                    <div className='w-full flex justify-between items-center bg-gradient-to-r from-secondary to-tertiary p-2 rounded-2xl '>
                                    
                                    <h3 className='font-semibold text-white'>
                                        {(() => {
                                            if (!Array.isArray(daftarJadwal) || daftarJadwal.length === 0) {
                                                return "Tidak ada jadwal untuk hari ini";
                                            }
                                            const now = new Date();
                                            const menitSekarang = now.getHours() * 60 + now.getMinutes();
                                            const aktif = daftarJadwal.find(j => j.status === 'active');
                                            if (aktif) {
                                                return `Sedang berlangsung: ${aktif.judul || aktif.kegiatan}`;
                                            }
                                            const mendatang = daftarJadwal.find(j => {
                                                const jm = j.jam_mulai;;
                                                if (!jm) return false;
                                                const [h, m] = jm.split(':').map(Number);
                                                return (h * 60 + m) >= menitSekarang;
                                            });
                                            if (!mendatang) return "Semua jadwal hari ini telah selesai";
                                            const [h, m] = (mendatang.jam_mulai || mendatang.jam).split(':').map(Number);
                                            const selisih = (h * 60 + m) - menitSekarang;
                                            const jamSisa = Math.floor(selisih / 60);
                                            const menitSisa = selisih % 60;
                                            const textSisa = jamSisa > 0 ? `${jamSisa} jam ${menitSisa} menit` : `${menitSisa} menit`;
                                            return `${mendatang.judul || mendatang.kegiatan} dalam ${textSisa}`;
                                        })()}
                                    </h3>
                                    
                                    </div>
                                    <div className='border border-yellow-500 p-2 rounded-xl text-yellow-900'>
                                        <p>{currentTime}</p>
                                    </div>
                                </div>
                                
                            )}

                            <div className='relative z-10 space-y-3 overflow-y-auto hide-scrollbar max-h-[380px] pr-2'>
                                {jadwal === 'hari ini' && !isDataGrouped ? (
                                    <>
                                        {daftarJadwal.map((item) => {
                                            const jamMulai = item.jam_mulai || item.jam || '00:00';
                                            const jamSelesai = item.jam_selesai;
                                            const judul = item.judul || item.kegiatan || 'Tanpa Judul';
                                            const kategori = item.kategori || 'rutinitas';

                                            let cardStyle = "flex-1 p-3.5 rounded-2xl border transition-all duration-300 ";
                                            let textStyle = "text-base font-semibold ";
                                            
                                            if (item.status === 'active') {
                                                cardStyle += "bg-emerald-500/10 border-emerald-500/40 shadow-sm";
                                                textStyle += "text-emerald-700 font-bold";
                                            } else if (item.status === 'completed') {
                                                cardStyle += "bg-slate-100/60 border-slate-200/60 opacity-50";
                                                textStyle += "text-slate-400 line-through font-normal";
                                            } else {
                                                cardStyle += "bg-white/80 border-slate-200/60 hover:border-slate-300";
                                                textStyle += "text-slate-800";
                                            }
                                            
                                            return (
                                                <div className='flex gap-3 px-2 py-1 items-start' key={item.id}>
                                                    <div className="w-16 shrink-0 pt-1 text-right">
                                                        <span className="text-xs font-bold text-slate-700 font-mono block">{jamMulai}</span>
                                                        {jamSelesai && (
                                                            <span className="text-[11px] text-slate-400 font-mono block">{jamSelesai}</span>
                                                        )}
                                                    </div>
                                                    <div className={cardStyle}>
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                                kategori === 'kuliah' 
                                                                    ? 'bg-blue-100 text-blue-700' 
                                                                    : kategori === 'kegiatan' 
                                                                    ? 'bg-amber-100 text-amber-700' 
                                                                    : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                                {kategori}
                                                            </span>
                                                            {item.ruangan && (
                                                                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                    Ruang: <strong className="text-slate-700">{item.ruangan}</strong>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h2 className={textStyle}>{judul}</h2>
                                                        {item.dosen && (
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                Dosen: <span className="font-medium text-slate-700">{item.dosen}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    {item.status === 'active' && (
                                                        <span className="flex h-3 w-3 relative mt-3 shrink-0">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {daftarJadwal.length === 0 && (
                                            <div className='flex items-center justify-center py-8'>
                                                <p className='text-slate-400 text-sm'>Tidak ada jadwal hari ini</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {isDataGrouped && daftarJadwal.map((dayGroup) => (
                                            <div key={dayGroup.tanggal} className="space-y-2 mb-4">
                                                {/* Day Header */}
                                                <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200/60">
                                                    <h4 className={`text-xs font-bold uppercase tracking-wider ${dayGroup.is_hari_ini ? 'text-blue-600' : 'text-slate-500'}`}>
                                                        {dayGroup.hari}, {dayGroup.tanggal} {dayGroup.is_hari_ini ? '(Hari Ini)' : ''}
                                                    </h4>
                                                    <span className="text-[11px] text-slate-400">{dayGroup.items.length} Kegiatan</span>
                                                </div>
                                                
                                                {/* Day Items */}
                                                {dayGroup.items.map((item) => {
                                                    const jamMulai = item.jam_mulai || item.jam || '00:00';
                                                    const jamSelesai = item.jam_selesai;
                                                    const judul = item.judul || item.kegiatan || 'Tanpa Judul';
                                                    const kategori = item.kategori || 'rutinitas';

                                                    let cardStyle = "flex-1 p-3 rounded-xl border bg-white/80 border-slate-200/60 transition-all";
                                                    let textStyle = "text-sm font-semibold text-slate-800";
                                                    
                                                    if (dayGroup.is_hari_ini) {
                                                        if (item.status === 'active') {
                                                            cardStyle = "flex-1 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10";
                                                            textStyle = "text-sm font-bold text-emerald-700";
                                                        } else if (item.status === 'completed') {
                                                            cardStyle = "flex-1 p-3 rounded-xl border border-slate-200/40 bg-slate-100/50 opacity-50";
                                                            textStyle = "text-sm font-medium text-slate-400 line-through";
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <div className="flex gap-3 px-3 py-1 items-start" key={item.id}>
                                                            <div className="w-16 shrink-0 pt-1 text-right">
                                                                <span className="text-xs font-bold text-slate-700 font-mono block">{jamMulai}</span>
                                                                {jamSelesai && (
                                                                    <span className="text-[10px] text-slate-400 font-mono block">{jamSelesai}</span>
                                                                )}
                                                            </div>
                                                            <div className={cardStyle}>
                                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                                        kategori === 'kuliah' 
                                                                            ? 'bg-blue-100 text-blue-700' 
                                                                            : 'bg-purple-100 text-purple-700'
                                                                    }`}>
                                                                        {kategori}
                                                                    </span>
                                                                    {item.ruangan && (
                                                                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                                                            Ruang: <strong className="text-slate-700">{item.ruangan}</strong>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h2 className={textStyle}>{judul}</h2>
                                                                {item.dosen && (
                                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                                        Dosen: <span className="font-medium text-slate-700">{item.dosen}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {dayGroup.items.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic px-4 py-1">Tidak ada kegiatan</p>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    }



                </div>
                <div className='col-span-2 row-span-4 bg-white/30 rounded-3xl shadow-lg p-container-padding'>
                    <h2>Statistik</h2>

                </div>
            </div>
        </div>
    );
}
