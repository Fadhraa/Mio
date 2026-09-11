import React, { useState, useEffect, useRef } from 'react';
import {
    Cpu, Brain, Clock, FileText, Search, Send, X, LayoutDashboard, Home, Calendar, BookOpen, Settings, MessageSquare, Bot,
    Sparkles, Key, ShieldCheck
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { apiFetch, getStoredApiKey } from './services/api';
import AuthModal from './components/AuthModal';

export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [inputText, setInputText] = useState('');
    const [attachedImage, setAttachedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [hasKey, setHasKey] = useState(!!getStoredApiKey());
    const [messages, setMessages] = useState([
        {
            sender: 'bot',
            text: 'Halo Fadhra! Tampilan dashboard React + Tailwind aku sudah siap. Sekarang aku juga bisa menerima tangkapan layar (screenshot) lewat tombol klip atau langsung kamu paste (Ctrl+V) ke sini!'
        }
    ]);

    const chatWindowRef = useRef(null);
    const fileInputRef = useRef(null);

    // Pantau event autentikasi sistem
    useEffect(() => {
        const onAuthRequired = () => setIsAuthModalOpen(true);
        const onKeyChanged = (e) => setHasKey(!!e.detail);

        window.addEventListener('mio:auth-required', onAuthRequired);
        window.addEventListener('mio:api-key-changed', onKeyChanged);
        return () => {
            window.removeEventListener('mio:auth-required', onAuthRequired);
            window.removeEventListener('mio:api-key-changed', onKeyChanged);
        };
    }, []);


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

    // Auto-scroll ke bawah saat ada pesan baru
    useEffect(() => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Global Paste Event Listener untuk menempelkan gambar (Ctrl+V)
    useEffect(() => {
        const handlePaste = (e) => {
            if (activeTab !== 'dashboard') return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        bacaFileGambar(file);
                        e.preventDefault();
                        break;
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [activeTab]);

    const bacaFileGambar = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setAttachedImage(e.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            bacaFileGambar(file);
        }
    };

    const removeAttachedImage = () => {
        setAttachedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Kirim Pesan ke API Backend (lewat proxy Vite)
    const handleSend = async () => {
        const textToSend = inputText.trim();
        const imageToSend = attachedImage;

        if (!textToSend && !imageToSend) return;

        const userMessage = { sender: 'user', text: textToSend };
        if (imageToSend) {
            userMessage.image = imageToSend;
        }

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        removeAttachedImage();
        setIsLoading(true);

        try {
            const res = await apiFetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: textToSend,
                    image: imageToSend
                })
            });

            const data = await res.json();

            if (data.error) {
                setMessages(prev => [...prev, { sender: 'bot', text: `Terjadi kesalahan: ${data.error}` }]);
            } else {
                setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { sender: 'bot', text: 'Gagal terhubung ke server Mio AI. Pastikan server backend Anda aktif dan API Key valid.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMarkdown = (text) => {
        if (!text) return '';
        const parts = text.split('\n');
        return parts.map((line, i) => {
            let formatted = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code class="bg-slate-950/60 px-1 py-0.5 rounded text-violet-400">$1</code>');

            return (
                <span
                    key={i}
                    className="block min-h-[1rem]"
                    dangerouslySetInnerHTML={{ __html: formatted }}
                />
            );
        });
    };

    return (
        <div className="bg-surface mesh-bg min-h-screen font-body-md text-on-surface flex">
            {/* sidebar */}
            <aside className="fixed left-0 top-0 flex z-50 border-outline-variant/30 border-r h-screen w-72 flex-col bg-white">
                <div className="p-8 text-2xl text-gray-800 font-bold ">
                    <span className='text-4xl font-extrabold bg-gradient-to-r from-secondary to-tertiary bg-clip-text text-transparent'>Mio</span> Dashboard
                </div>
                {/* List sidebar Navigation*/}
                <div className="flex-1 px-4 space-y-2">
                    <NavLink to="/" className="flex items-center justify-center bg-gradient-to-r from-tertiary to-accent-green gap-2 px-4 py-3 rounded-2xl text-on-surface-variant  transition-all">
                        <Sparkles className="text-white  animate-pulse" />
                        <span className="font-label-md text-xl font-bold text-center text-white">Mio</span>
                    </NavLink>
                    <NavLink to="/dashboard" className="flex items-center gap-4 px-4 py-3 rounded-2xl text-on-surface-variant hover:bg-secondary/5 transition-all">
                        <LayoutDashboard />
                        <span className="font-label-md">Dashboard</span>
                    </NavLink>
                    <NavLink to="/jadwal" className="flex items-center gap-4 px-4 py-3 rounded-2xl text-on-surface-variant hover:bg-secondary/5 transition-all">
                        <Calendar />
                        <span className="font-label-md">Jadwal</span>
                    </NavLink>
                    <NavLink to="/jadwal" className="flex items-center gap-4 px-4 py-3 rounded-2xl text-on-surface-variant hover:bg-secondary/5 transition-all">
                        <BookOpen />
                        <span className="font-label-md">Akademik</span>
                    </NavLink>
                    <NavLink to="/jadwal" className="flex items-center gap-4 px-4 py-3 rounded-2xl text-on-surface-variant hover:bg-secondary/5 transition-all">
                        <FileText />
                        <span className="font-label-md">Dokumen</span>
                    </NavLink>
                </div>
            </aside>
            {/* main content */}
            <div className='flex-1 ml-72'>
                <header className='h-auto mx-8 mt-4 flex items-center justify-between'>
                    <div className='relative w-96'>
                        <input className='w-full py-2 px-4 bg-white/40 border border-slate-200/50 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-transparent transition-all font-body-md text-sm text-gray-700' type="text" placeholder='Minta Mio melakukan sesuatu...' />
                        <span className='absolute right-4 top-2.5 text-gray-500'>
                            <Search size={18} />
                        </span>
                    </div>

                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            hasKey
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse'
                        }`}
                        title="Kelola Kunci Akses API Mio"
                    >
                        {hasKey ? <ShieldCheck size={15} /> : <Key size={15} />}
                        <span>{hasKey ? 'API Key Terhubung' : 'Sambungkan API Key'}</span>
                    </button>
                </header>
                <main className='py-8 px-container-padding max-w-width-desktop'>
                    <Outlet />
                </main>
            </div>

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={() => setHasKey(true)}
            />
        </div>
    );
}
