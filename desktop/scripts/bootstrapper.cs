using System;
using System.Net;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace GuildManagerBootstrapper
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Console.Title = "Xava Guild Manager - Universal Setup";
            Console.ForegroundColor = ConsoleColor.Magenta;
            Console.WriteLine("========================================");
            Console.WriteLine("    XAVA GUILD MANAGER UNIVERSAL SETUP  ");
            Console.WriteLine("========================================");
            Console.ResetColor();
            Console.WriteLine();

            string baseUrl = "https://guidmanager-production.up.railway.app";
            string infoUrl = baseUrl + "/api/update/info";
            string downloadUrl = baseUrl + "/api/download/latest";
            string tempPath = Path.Combine(Path.GetTempPath(), "GuildManagerSetup_Latest.exe");

            try
            {
                // Force latest TLS
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2

                string version = "Unknown";
                using (WebClient client = new WebClient())
                {
                    Console.WriteLine("--> Checking for latest version...");
                    try {
                        string json = client.DownloadString(infoUrl);
                        // Simple JSON parsing (since we don't want external dependencies)
                        if (json.Contains("\"version\":\"")) {
                            version = json.Split(new string[] { "\"version\":\"" }, StringSplitOptions.None)[1].Split('\"')[0];
                        }
                    } catch {
                        Console.WriteLine("[WARNING] Could not retrieve version info, proceeding with generic download.");
                    }
                }

                DialogResult result = MessageBox.Show(
                    string.Format("Möchten Sie Guild Manager Version {0} herunterladen und installieren?", version),
                    "Xava Guild Manager Update",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );

                if (result != DialogResult.Yes)
                {
                    Console.WriteLine("--> Download cancelled by user.");
                    Thread.Sleep(1000);
                    return;
                }

                using (WebClient client = new WebClient())
                {
                    Console.WriteLine("--> Downloading latest installer (this may take a moment)...");
                    
                    // Simple progress reporting
                    client.DownloadProgressChanged += (s, e) => {
                        Console.Write("\r    Progress: " + e.ProgressPercentage + "% (" + (e.BytesReceived / 1024 / 1024) + "MB / " + (e.TotalBytesToReceive / 1024 / 1024) + "MB)");
                    };

                    client.DownloadFileTaskAsync(new Uri(downloadUrl), tempPath).Wait();
                    Console.WriteLine();
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("--> Download complete!");
                Console.ResetColor();
                Console.WriteLine("--> Starting installation...");

                Process.Start(tempPath);
                
                Console.WriteLine("--> Bootstrapper closing in 3 seconds...");
                Thread.Sleep(3000);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[ERROR] Failed to download or start installer:");
                Console.WriteLine(ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nPlease check your internet connection and try again.");
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
            }
        }
    }
}
