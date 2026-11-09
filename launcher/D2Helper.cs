using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

// D2Helper launcher: opens index.html as a standalone app window (Edge/Chrome app mode)
// with its own profile stored next to the exe (data\profile).
static class Program
{
    [STAThread]
    static void Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string html = Path.Combine(dir, "index.html");
        if (!File.Exists(html))
        {
            MessageBox.Show("Не найден файл index.html рядом с D2Helper.exe.\nДержи exe в папке приложения.", "D2Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string pf = Environment.GetEnvironmentVariable("ProgramW6432") ?? Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates = {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };
        string browser = null;
        foreach (var c in candidates) if (File.Exists(c)) { browser = c; break; }
        if (browser == null)
        {
            MessageBox.Show("Не найден Microsoft Edge или Google Chrome — они нужны для отображения окна D2Helper.", "D2Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        string profile = Path.Combine(dir, @"data\profile");
        Directory.CreateDirectory(profile);
        // Онлайн-адрес из app-url.txt (обновления приходят сразу всем), иначе — локальные файлы
        string url = new Uri(html).AbsoluteUri;
        string cfg = Path.Combine(dir, "app-url.txt");
        if (File.Exists(cfg))
        {
            string u = File.ReadAllText(cfg).Trim();
            if (u.StartsWith("https://")) url = u;
        }
        string args = "--app=\"" + url + "\" --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check " +
                      "--window-size=1440,920 --disable-features=Translate,msEdgeSidebarV2 --edge-skip-compat-layer-relaunch";
        try
        {
            Process.Start(new ProcessStartInfo(browser, args) { UseShellExecute = false, WorkingDirectory = dir });
        }
        catch (Exception ex)
        {
            MessageBox.Show("Не удалось запустить окно: " + ex.Message, "D2Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
