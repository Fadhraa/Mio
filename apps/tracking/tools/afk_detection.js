const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const exePath = path.join(__dirname, "getIdle.exe");

// 1. Buat ulang sistem detektor AFK Windows agar berjalan terus-menerus
// (Gunakan '|| true' sementara agar memaksa file .exe diperbarui)
if (!fs.existsSync(exePath)) {
  console.log("Membangun ulang sistem detektor AFK Windows (Optimized)...");
  const csCode = `
    using System;
    using System.Runtime.InteropServices;
    using System.Threading;
    class Program {
        [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
        struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
        static void Main() {
            LASTINPUTINFO lastInPut = new LASTINPUTINFO();
            lastInPut.cbSize = (uint)Marshal.SizeOf(lastInPut);
            while(true) {
                GetLastInputInfo(ref lastInPut);
                uint idleTime = ((uint)Environment.TickCount - lastInPut.dwTime) / 1000;
                Console.WriteLine(idleTime);
                Thread.Sleep(1000); // Kalkulasi setiap 1 detik
            }
        }
    }
  `;
  fs.writeFileSync("getIdle.cs", csCode);
  const cscPath = "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe";
  execSync(`"${cscPath}" /nologo /out:"${exePath}" getIdle.cs`);
  fs.unlinkSync("getIdle.cs");
}

// 2. Jalankan exe HANYA SEKALI di background menggunakan spawn
let currentIdleTime = 0;
const childProcess = spawn(exePath);

// Tangkap output stream dari exe dan update ke variabel
childProcess.stdout.on("data", (data) => {
  const lines = data.toString().trim().split('\n');
  const latest = lines[lines.length - 1];
  if (latest) {
    currentIdleTime = parseInt(latest) || 0;
  }
});

childProcess.on("error", (err) => {
  console.error("Detektor AFK error:", err);
});

// 3. Fungsi ini sekarang sangat ringan karena hanya me-return variabel di memori
function getIdleTimeSeconds() {
  return currentIdleTime;
}

module.exports = { getIdleTimeSeconds };
