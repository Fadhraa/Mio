import speech_recognition as sr
import sys

def main():
    r = sr.Recognizer()
    
    # Memberikan waktu toleransi jeda (diam) selama 2.5 detik sebelum kalimat dipotong
    r.pause_threshold = 2.5
    
    # Menurunkan batas minimal volume suara agar lebih peka terhadap suara pelan
    r.energy_threshold = 150
    # Mematikan penyesuaian otomatis agar sensitivitas tidak menjadi 'budek' secara tiba-tiba
    r.dynamic_energy_threshold = False
    
    m = sr.Microphone()

    # Kalibrasi awal untuk mengukur kebisingan ruangan
    with m as source:
        r.adjust_for_ambient_noise(source, duration=2)
    
    # Memberi sinyal ke Node.js bahwa telinga sudah siap
    print("READY", flush=True) 

    # Looping tanpa henti untuk terus mendengarkan
    while True:
        with m as source:
            try:
                # Mendengarkan suara (timeout=1 agar tidak ngehang, batas kalimat=5 detik)
                audio = r.listen(source, timeout=1, phrase_time_limit=20)
                
                # Mengubah rekaman suara jadi teks (Bahasa Indonesia)
                teks = r.recognize_google(audio, language="id-ID").lower()
             
                

                variasi_panggilan = [
                    "halo mio", "hallo mio", "halo miu", "halo miow", "halo neo", 
                    "halo mil", "halo bio", "hellow mio", "hello miyo", "halo miyoh", 
                    "hallo miyoh", "halo nio", "kalau mio", "halo leo", "halo biyu"
                ]
                
                # 2. Cari tahu apakah dari daftar di atas, ada SATU SAJA yang terdeteksi di suara Anda
                panggilan_terdeteksi = None
                for panggilan in variasi_panggilan:
                    if panggilan in teks:
                        panggilan_terdeteksi = panggilan
                        break
                
                if panggilan_terdeteksi: 
                    perintah = teks.split(panggilan_terdeteksi)[-1].strip()
                    
                    if perintah:
                        # Print perintahnya agar BISA DIBACA oleh Node.js
                        print(f"PERINTAH:{perintah}", flush=True)
                    else:
                        print("DEBUG: Anda memanggil Mio, tapi tidak ada perintah", flush=True)
            except sr.WaitTimeoutError:
                pass # Abaikan jika ruangan sepi
            except sr.UnknownValueError:
                pass
                # Abaikan suara berisik yang bukan kata-kata
            except sr.RequestError:
                print("ERROR: Gagal menghubungi server pengenal suara", flush=True)
            except Exception:
                print("DEBUG: Terjadi error tak terduga", flush=True)

if __name__ == "__main__":
    main()
