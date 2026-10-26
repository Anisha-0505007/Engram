using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

class Setup {
    [STAThread]
    static void Main() {
        if (MessageBox.Show("Install Engram Personal Connector for this Windows account?\n\nIncludes Node.js. No administrator access is needed. After installation, return to your dashboard and click Open connector.",
            "Engram connector setup", MessageBoxButtons.OKCancel) != DialogResult.OK) return;
        try {
            string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EngramConnector");
            Directory.CreateDirectory(root);
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Read)) {
                foreach (var entry in archive.Entries) {
                    string destination = Path.GetFullPath(Path.Combine(root, entry.FullName));
                    // Fail closed if a malformed archive tries to write outside the install directory.
                    if (!destination.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                        throw new IOException("Invalid archive path");
                    if (entry.Name == "") { Directory.CreateDirectory(destination); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    entry.ExtractToFile(destination, true);
                }
            }
            // Per-user registration avoids administrator access and does not affect other Windows users.
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\engram")) {
                key.SetValue("", "URL:Engram Personal Connector");
                key.SetValue("URL Protocol", "");
                using (var command = key.CreateSubKey(@"shell\open\command"))
                    command.SetValue("", "\"" + Path.Combine(root, "EngramConnector.exe") + "\" \"%1\"");
            }
            MessageBox.Show("Installed. Return to Engram and click Open connector. Allow your browser to open EngramConnector when prompted.\n\nKeep the connector terminal open while saving messages.", "Engram");
        } catch {
            MessageBox.Show("Installation did not finish. Close any running connector and try again. Check available disk space and folder permissions.", "Engram setup");
            Environment.ExitCode = 1;
        }
    }
}
