slint::slint! {
    export component NotchWindow inherits Window {
        in-out property <string> app_name: "Menghubungkan...";
        in-out property <string> category_name: "STANDBY";
        in-out property <string> duration_text: "0s";
        in-out property <bool> is_idle: false;
        in-out property <bool> is_connected: false;

        title: "Mio Notch";
        no-frame: true;
        always-on-top: true;
        background: transparent;
        width: 290px;
        height: 42px;

        Rectangle {
            width: 100%;
            height: 100%;
            border-radius: 21px;
            background: #11111b;
            HorizontalLayout {
                padding-left: 14px;
                padding-right: 14px;
                spacing: 8px;

                // Kiri: Status Dot & Nama Aplikasi
                HorizontalLayout {
                    spacing: 8px;
                    horizontal-stretch: 1;

                    Rectangle {
                        width: 8px;
                        height: 8px;
                        border-radius: 4px;
                        background: !root.is_connected ? #6c7086 : (root.is_idle ? #fab387 : #a6e3a1);
                        y: (parent.height - self.height) / 2;
                    }

                    Text {
                        text: root.app_name;
                        color: #cdd6f4;
                        font-size: 11px;
                        font-weight: 700;
                        overflow: elide;
                        vertical-alignment: center;
                    }
                }

                // Kanan: Kategori & Durasi
                HorizontalLayout {
                    spacing: 6px;
                    horizontal-stretch: 0;

                    Rectangle {
                        background: #313244;
                        border-radius: 6px;
                        height: 20px;
                        y: (parent.height - self.height) / 2;

                        HorizontalLayout {
                            padding-left: 6px;
                            padding-right: 6px;
                            Text {
                                text: root.category_name;
                                color: root.is_idle ? #fab387 : #89b4fa;
                                font-size: 9px;
                                font-weight: 700;
                                vertical-alignment: center;
                            }
                        }
                    }

                    Text {
                        text: root.duration_text;
                        color: #a6adc8;
                        font-size: 10px;
                        vertical-alignment: center;
                    }
                }
            }
        }
    }
}

use serde::Deserialize;
use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GetSystemMetrics, GetWindowLongW, SetWindowLongW, SetWindowPos, GWL_EXSTYLE,
    HWND_TOPMOST, SM_CXSCREEN, SWP_NOACTIVATE, SWP_NOSIZE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
};
use windows::core::HSTRING;

#[derive(Debug, Deserialize, Clone)]
struct TrackingPayload {
    category: Option<String>,
    app: Option<String>,
    duration: Option<u64>,
    is_idle: Option<bool>,
}

fn format_duration(seconds: u64) -> String {
    if seconds < 60 {
        format!("{}s", seconds)
    } else if seconds < 3600 {
        format!("{}m {}s", seconds / 60, seconds % 60)
    } else {
        format!("{}j {}m", seconds / 3600, (seconds % 3600) / 60)
    }
}

fn apply_windows_notch_styles(title: &str, window_width: i32, top_offset: i32) {
    let title_hstring = HSTRING::from(title);
    thread::sleep(Duration::from_millis(200));

    unsafe {
        if let Ok(hwnd) = FindWindowW(None, &title_hstring) {
            // Tambahkan style WS_EX_TOOLWINDOW agar tidak muncul di Taskbar & Alt+Tab
            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
            let new_style = ex_style | WS_EX_TOOLWINDOW.0 as i32 | WS_EX_TOPMOST.0 as i32;
            SetWindowLongW(hwnd, GWL_EXSTYLE, new_style);

            // Posisi tengah layar bagian atas
            let screen_width = GetSystemMetrics(SM_CXSCREEN);
            let pos_x = (screen_width - window_width) / 2;

            SetWindowPos(
                hwnd,
                Some(HWND_TOPMOST),
                pos_x,
                top_offset,
                0,
                0,
                SWP_NOSIZE | SWP_NOACTIVATE,
            )
            .ok();
            println!("[Notch Win32] Notch berhasil diposisikan di Top-Center ({pos_x}, {top_offset})");
        }
    }
}

fn start_tcp_listener(weak_handle: slint::Weak<NotchWindow>) {
    thread::spawn(move || {
        let connected_flag = Arc::new(AtomicBool::new(false));

        loop {
            match TcpStream::connect("127.0.0.1:5006") {
                Ok(stream) => {
                    println!("[TCP Client] Terhubung ke Mio Tracking Daemon (port 5006)!");
                    connected_flag.store(true, Ordering::SeqCst);

                    let weak = weak_handle.clone();
                    weak.upgrade_in_event_loop(move |ui| {
                        ui.set_is_connected(true);
                        ui.set_app_name("Mio Terhubung".into());
                    })
                    .ok();

                    let reader = BufReader::new(stream);
                    for line in reader.lines() {
                        match line {
                            Ok(text) => {
                                let trimmed = text.trim();
                                if trimmed.is_empty() {
                                    continue;
                                }

                                if let Ok(data) = serde_json::from_str::<TrackingPayload>(trimmed) {
                                    let weak = weak_handle.clone();
                                    weak.upgrade_in_event_loop(move |ui| {
                                        if let Some(app) = data.app {
                                            ui.set_app_name(app.into());
                                        }
                                        if let Some(cat) = data.category {
                                            ui.set_category_name(cat.into());
                                        }
                                        if let Some(dur) = data.duration {
                                            ui.set_duration_text(format_duration(dur).into());
                                        }
                                        if let Some(idle) = data.is_idle {
                                            ui.set_is_idle(idle);
                                        }
                                        ui.set_is_connected(true);
                                    })
                                    .ok();
                                }
                            }
                            Err(_) => {
                                println!("[TCP Client] Koneksi terputus.");
                                break;
                            }
                        }
                    }
                }
                Err(_) => {
                    let weak = weak_handle.clone();
                    weak.upgrade_in_event_loop(move |ui| {
                        ui.set_is_connected(false);
                        ui.set_app_name("Mencari Mio Tracking...".into());
                        ui.set_category_name("DISCONNECTED".into());
                    })
                    .ok();
                }
            }

            thread::sleep(Duration::from_secs(3));
        }
    });
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=======================================================");
    println!("🚀 Memulai Mio Windows Notch (Native Rust Client)");
    println!("⚡ Target: < 20MB RAM, 0% CPU Idle, Zero Browser Engine");
    println!("=======================================================");

    let app = NotchWindow::new()?;
    let weak_handle = app.as_weak();

    // 1. Thread listener TCP socket ke apps/tracking
    start_tcp_listener(weak_handle);

    // 2. Thread Win32 Window Styles & Centering
    thread::spawn(|| {
        apply_windows_notch_styles("Mio Notch", 290, 4);
    });

    // 3. Jalankan event-loop Slint
    app.run()?;

    Ok(())
}
