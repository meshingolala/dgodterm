using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;

namespace DgodTerm.Windows
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            DispatcherUnhandledException += (s, args) =>
            {
                Log($"[DispatcherUnhandledException] {args.Exception}");
            };
            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                Log($"[AppDomain UnhandledException] {args.ExceptionObject}");
            };
            TaskScheduler.UnobservedTaskException += (s, args) =>
            {
                Log($"[UnobservedTaskException] {args.Exception}");
            };
        }

        private static void Log(string message)
        {
            try
            {
                string logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DgodTerm");
                Directory.CreateDirectory(logDir);
                string logFile = Path.Combine(logDir, "native-log.txt");
                File.AppendAllText(logFile, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}{Environment.NewLine}");
            }
            catch { }
        }
    }
}
