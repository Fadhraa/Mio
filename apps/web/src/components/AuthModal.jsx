import React, { useState, useEffect } from 'react';
import { Key, Shield, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { getStoredApiKey, saveApiKey, clearApiKey, verifyApiKey } from '../services/api';

export default function AuthModal({ isOpen, onClose, onSuccess, isMandatory = false }) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(getStoredApiKey());
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setStatus('error');
      setErrorMessage('API Key tidak boleh kosong.');
      return;
    }

    setStatus('checking');
    setErrorMessage('');

    const res = await verifyApiKey(trimmed);
    if (res.ok) {
      saveApiKey(trimmed);
      setStatus('success');
      setTimeout(() => {
        if (onSuccess) onSuccess(trimmed);
        if (onClose) onClose();
      }, 700);
    } else {
      setStatus('error');
      setErrorMessage(res.error || 'Verifikasi API Key gagal.');
    }
  };

  const handleClear = () => {
    clearApiKey();
    setApiKeyInput('');
    setStatus('idle');
    setErrorMessage('Kunci API telah dihapus dari browser.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">Otentikasi Mio Server</h3>
              <p className="text-xs text-slate-500">Kunci Akses Komunikasi Antar-Aplikasi</p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Masukkan <strong>MIO_API_KEY</strong> dari konfigurasi server Anda untuk mengamankan pertukaran data dan mencegah akses tanpa izin.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Mio API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="mio_sec_..."
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feedback Status */}
          {status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Kunci terverifikasi. Menyambungkan ke Mio Core...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {apiKeyInput ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
              >
                Hapus Kunci
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              {!isMandatory && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={status === 'checking' || !apiKeyInput.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                {status === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{status === 'checking' ? 'Memverifikasi...' : 'Simpan & Verifikasi'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Modal Footer Info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
          Kunci ini disimpan secara privat di browser lokal Anda.
        </div>
      </div>
    </div>
  );
}
