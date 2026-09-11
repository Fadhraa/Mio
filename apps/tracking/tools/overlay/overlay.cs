using System;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Runtime.InteropServices;
using System.Windows.Interop;

namespace HaloMioOverlay
{
    public class Program
    {
        [STAThread]
        public static void Main()
        {
            App app = new App();
            app.Run(new MainWindow());
        }
    }

    public class App : Application { }

    public class MainWindow : Window
    {
        private TextBlock statusText;
        private TextBlock subText;
        private Ellipse dot;
        private TcpClient client;
        private StreamReader reader;

        [DllImport("user32.dll")]
        public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        public MainWindow()
        {
            // Konfigurasi Window (Gaya Minimalis Click-Through)
            this.Title = "HaloMioOverlay";
            this.Height = 55;
            this.Width = 240;
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = Brushes.Transparent;
            this.Topmost = true;
            this.ShowInTaskbar = false;
            this.WindowStartupLocation = WindowStartupLocation.Manual;
            this.Left = 30;
            this.Top = 30;

            // Desain UI (Gaya Catppuccin Dark Mode)
            Border border = new Border
            {
                CornerRadius = new CornerRadius(8),
                BorderThickness = new Thickness(1.5),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1E1E2E")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#89B4FA")),
                Opacity = 0.9,
                Padding = new Thickness(12, 0, 12, 0)
            };

            Grid grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            dot = new Ellipse
            {
                Width = 10,
                Height = 10,
                Fill = Brushes.LightGreen,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 12, 0)
            };
            Grid.SetColumn(dot, 0);
            grid.Children.Add(dot);

            StackPanel textPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            statusText = new TextBlock
            {
                Text = "HALOMIO ACTIVE",
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CDD6F4")),
                FontSize = 11,
                FontWeight = FontWeights.Bold,
                FontFamily = new FontFamily("Segoe UI")
            };
            subText = new TextBlock
            {
                Text = "Initializing...",
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#A6ADC8")),
                FontSize = 9,
                FontFamily = new FontFamily("Segoe UI"),
                TextTrimming = TextTrimming.CharacterEllipsis
            };
            textPanel.Children.Add(statusText);
            textPanel.Children.Add(subText);

            Grid.SetColumn(textPanel, 1);
            grid.Children.Add(textPanel);

            border.Child = grid;
            this.Content = border;

            this.SourceInitialized += MainWindow_SourceInitialized;
            this.Loaded += MainWindow_Loaded;
            this.Closed += MainWindow_Closed;
        }

        private void MainWindow_SourceInitialized(object sender, EventArgs e)
        {
            // Membuat window ini click-through (ditembus kursor) lewat Win32 API
            var helper = new WindowInteropHelper(this);
            int initialStyle = GetWindowLong(helper.Handle, -20); // GWL_EXSTYLE
            SetWindowLong(helper.Handle, -20, initialStyle | 0x00080020); // WS_EX_TRANSPARENT | WS_EX_LAYERED
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Jalankan TCP Client di background thread agar tidak membekukan UI thread utama
            Task.Run(() => ConnectAndListen());
        }

                private async Task ConnectAndListen()
        {
            while (true)
            {
                bool connectFailed = false;
                if (client == null || !client.Connected)
                {
                    try
                    {
                        client = new TcpClient();
                        await client.ConnectAsync("127.0.0.1", 5006);
                        NetworkStream stream = client.GetStream();
                        reader = new StreamReader(stream, Encoding.UTF8);
                    }
                    catch
                    {
                        client = null;
                        connectFailed = true;
                    }

                    if (connectFailed)
                    {
                        // Taruh di luar catch agar kompatibel dengan C# 5
                        await Task.Delay(2000); 
                        continue;
                    }
                }

                bool readFailed = false;
                try
                {
                    string line = await reader.ReadLineAsync();
                    if (line == null) throw new Exception("Server disconnected");

                    // Kirim pembaruan teks ke UI thread menggunakan Dispatcher
                    this.Dispatcher.Invoke(() => UpdateUI(line));
                }
                catch
                {
                    if (client != null) client.Close();
                    client = null;
                    readFailed = true;
                }

                if (readFailed)
                {
                    // Taruh di luar catch agar kompatibel dengan C# 5
                    await Task.Delay(1000); 
                }
            }
        }


        private void UpdateUI(string json)
        {
            try
            {
                // Parsing JSON sederhana secara manual untuk menghindari dependensi DLL eksternal
                string category = GetJsonValue(json, "category");
                string app = GetJsonValue(json, "app");
                string durationStr = GetJsonValue(json, "duration");
                string isIdleStr = GetJsonValue(json, "is_idle");

                int duration = 0;
                int.TryParse(durationStr, out duration);
                bool isIdle = isIdleStr == "true";

                string durasiFormatted = duration >= 60 ? (duration / 60) + "m " + (duration % 60) + "s" : duration + "s";

                if (isIdle)
                {
                    dot.Fill = Brushes.Red;
                    statusText.Text = "IDLE / AFK";
                    subText.Text = app + " (" + durasiFormatted + ")";
                }
                else
                {
                    dot.Fill = Brushes.LightGreen;
                    statusText.Text = category;
                    subText.Text = app + " (" + durasiFormatted + ")";
                }
            }
            catch { }
        }

        private string GetJsonValue(string json, string key)
        {
            string searchKey = "\"" + key + "\":";
            int keyIndex = json.IndexOf(searchKey);
            if (keyIndex == -1) return "";

            int valueStart = keyIndex + searchKey.Length;
            while (valueStart < json.Length && (json[valueStart] == ' ' || json[valueStart] == '"'))
            {
                valueStart++;
            }

            int valueEnd = valueStart;
            if (json[valueStart - 1] == '"') {
                while (valueEnd < json.Length && json[valueEnd] != '"') { valueEnd++; }
            } else {
                while (valueEnd < json.Length && json[valueEnd] != ',' && json[valueEnd] != '}' && json[valueEnd] != ' ') { valueEnd++; }
            }

            return json.Substring(valueStart, valueEnd - valueStart);
        }

        private void MainWindow_Closed(object sender, EventArgs e)
        {
            if (client != null) client.Close();
            Environment.Exit(0);
        }
    }
}
