const STORAGE_KEY = 'mio_api_key';

/**
 * Mengambil API Key yang tersimpan dari LocalStorage atau fallback ke env.
 * @returns {string}
 */
export function getStoredApiKey() {
  const localKey = localStorage.getItem(STORAGE_KEY);
  if (localKey && localKey.trim()) return localKey.trim();
  const envKey = import.meta.env.VITE_MIO_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return '';
}

/**
 * Menyimpan API Key ke LocalStorage dan memicu event sinkronisasi.
 * @param {string} key 
 */
export function saveApiKey(key) {
  if (!key) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
  window.dispatchEvent(new CustomEvent('mio:api-key-changed', { detail: key }));
}

/**
 * Menghapus API Key yang tersimpan.
 */
export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('mio:api-key-changed', { detail: '' }));
}

/**
 * Memverifikasi validitas API Key ke server backend.
 * @param {string} key 
 * @returns {Promise<{ ok: boolean, error?: string, data?: any }>}
 */
export async function verifyApiKey(key) {
  const token = key !== undefined ? key.trim() : getStoredApiKey();
  if (!token) {
    return { ok: false, error: 'API Key wajib diisi.' };
  }

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 200 && data.ok) {
      return { ok: true, data };
    }
    return {
      ok: false,
      status: res.status,
      error: data.message || data.error || 'API Key tidak valid atau ditolak oleh server.',
    };
  } catch (err) {
    return {
      ok: false,
      error: 'Tidak dapat terhubung ke server Mio. Pastikan server backend sedang aktif.',
    };
  }
}

/**
 * Wrapper fetch terpusat yang otomatis menyertakan header otentikasi Bearer Token.
 * @param {string} endpoint 
 * @param {RequestInit} options 
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpoint, options = {}) {
  const token = getStoredApiKey();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('mio:auth-required', { detail: { endpoint } }));
  }

  return response;
}
