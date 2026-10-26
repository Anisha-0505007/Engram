using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

class Launcher {
    [STAThread]
    static void Main(string[] args) {
        using (var mutex = new Mutex(false, "Local\\EngramPersonalConnector")) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { owned = true; }
                if (!owned) { MessageBox.Show("The connector is already open. Look for its terminal window.", "Engram"); return; }
                Uri link;
                if (args.Length != 1 || !Uri.TryCreate(args[0], UriKind.Absolute, out link) ||
                    link.Scheme != "engram" || link.Host != "connect" || args[0].Length > 4096 ||
                    args[0].IndexOfAny(new char[] { '"', '\r', '\n', '\0' }) >= 0) {
                    MessageBox.Show("Open your Engram dashboard and click Open connector.", "Engram"); return;
                }
                string root = AppDomain.CurrentDomain.BaseDirectory;
                // No command shell: the URL is one quoted argument, never executable command text.
                var start = new ProcessStartInfo(Path.Combine(root, "node.exe"),
                    "\"" + Path.Combine(root, "src", "index.js") + "\" \"" + link.AbsoluteUri + "\"");
                start.WorkingDirectory = root;
                start.UseShellExecute = true;
                using (var child = Process.Start(start)) { child.WaitForExit(); }
            } catch {
                MessageBox.Show("Could not open the connector. Close its terminal, reinstall, then try again.", "Engram");
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
}
