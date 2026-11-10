using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using DgodTerm.Windows.Models;
using Microsoft.Web.WebView2.Core;
using Wpf.Ui.Controls;

namespace DgodTerm.Windows
{
    public partial class MainWindow : FluentWindow
    {
        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
        private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

        private Process? _backendProcess;
        private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        private const string ServerUrl = "http://127.0.0.1:5188";

        public ObservableCollection<NativeTabItem> Tabs { get; } = new();
        private string _currentTabStyle = "rounded";
        private string _currentAccentColor = "#E78A4E";
        private string _currentBackgroundColor = "#2D2F30";
        private string _currentForegroundColor = "#D4BE98";

        public MainWindow()
        {
            InitializeComponent();
            DataContext = this;

            // Default initial dashboard tab
            var initialTab = new NativeTabItem
            {
                Id = "tab-dashboard",
                Type = "dashboard",
                Title = "Workstation Dashboard",
                IsActive = true,
                CanClose = false,
                TabStyle = _currentTabStyle,
                ThemeAccentColor = _currentAccentColor,
                ThemeBackgroundColor = _currentBackgroundColor,
                ThemeForegroundColor = _currentForegroundColor
            };
            initialTab.UpdateVisualPresentation();
            Tabs.Add(initialTab);

            Loaded += MainWindow_Loaded;
            Closed += MainWindow_Closed;
            SizeChanged += MainWindow_SizeChanged;
        }

        private void TopBar_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left)
            {
                if (e.ClickCount == 2)
                {
                    WindowState = (WindowState == WindowState.Maximized) ? WindowState.Normal : WindowState.Maximized;
                }
                else
                {
                    try { DragMove(); } catch { }
                }
            }
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            Log("MainWindow_Loaded entered.");
            UpdateTabStripDimensions();
            ApplyImmersiveDarkMode();
            await EnsureBackendAndNavigateAsync();
        }

        private void ApplyImmersiveDarkMode()
        {
            try
            {
                var handle = new WindowInteropHelper(this).Handle;
                int useDarkMode = 1;
                DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[DgodTerm.Windows] Dark mode DWM attribute error: {ex.Message}");
            }
        }

        private async Task EnsureCoreWebView2InitializedAsync()
        {
            string baseFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "DgodTerm",
                "WebView2"
            );
            Directory.CreateDirectory(baseFolder);

            // Clean up stale instance directories from prior closed processes in the background
            _ = Task.Run(() =>
            {
                try
                {
                    foreach (var dir in Directory.GetDirectories(baseFolder, "inst-*"))
                    {
                        try { Directory.Delete(dir, true); } catch { }
                    }
                }
                catch { }
            });

            // Attempt 1: Shared primary user data folder
            try
            {
                Log($"Initializing WebView2 with primary folder: {baseFolder}");
                var env = await CoreWebView2Environment.CreateAsync(userDataFolder: baseFolder);
                await MainWebView.EnsureCoreWebView2Async(env);
                Log("Primary WebView2 environment initialized successfully.");
                return;
            }
            catch (Exception ex) when (ex is System.Runtime.InteropServices.COMException || ex.Message.Contains("0x800700AA") || ex.Message.Contains("resource is in use"))
            {
                Log($"[WebView2] Primary userDataFolder locked ({ex.Message}). Trying isolated process folder...");
            }

            // Attempt 2: Process-isolated instance folder (allows multi-window / concurrent instances without 0x800700AA lock conflicts)
            try
            {
                string procFolder = Path.Combine(baseFolder, $"inst-{Environment.ProcessId}");
                Directory.CreateDirectory(procFolder);
                Log($"Initializing WebView2 with isolated folder: {procFolder}");
                var env = await CoreWebView2Environment.CreateAsync(userDataFolder: procFolder);
                await MainWebView.EnsureCoreWebView2Async(env);
                Log("Process-isolated WebView2 environment initialized successfully.");
                return;
            }
            catch (Exception ex) when (ex is System.Runtime.InteropServices.COMException || ex.Message.Contains("0x800700AA") || ex.Message.Contains("resource is in use"))
            {
                Log($"[WebView2] Process folder locked ({ex.Message}). Trying temp isolated folder...");
            }

            // Attempt 3: Unique temp folder fallback
            string tempFolder = Path.Combine(Path.GetTempPath(), "DgodTerm-WV2-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempFolder);
            Log($"Initializing WebView2 with temp folder: {tempFolder}");
            var fallbackEnv = await CoreWebView2Environment.CreateAsync(userDataFolder: tempFolder);
            await MainWebView.EnsureCoreWebView2Async(fallbackEnv);
            Log("Temp WebView2 environment initialized successfully.");
        }

        private async Task EnsureBackendAndNavigateAsync()
        {
            Log("EnsureBackendAndNavigateAsync entered.");
            bool isRunning = await CheckBackendReadyAsync();
            Log($"Backend initial ready check: {isRunning}");
            if (!isRunning)
            {
                StartBackendProcess();
            }

            try
            {
                await EnsureCoreWebView2InitializedAsync();

                MainWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                MainWebView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                MainWebView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                if (!isRunning)
                {
                    for (int i = 0; i < 60; i++)
                    {
                        if (await CheckBackendReadyAsync())
                        {
                            isRunning = true;
                            Log($"Backend became ready at iteration {i}.");
                            break;
                        }
                        await Task.Delay(80);
                    }
                }

                if (!isRunning)
                {
                    Log("[Warning] Backend was not ready before navigation. Serving graceful connecting screen with auto-retry.");
                    MainWebView.CoreWebView2.NavigateToString(@"
<!DOCTYPE html>
<html>
<head><meta charset='utf-8'><title>DgodTerm Engine</title>
<style>
  body { background: #18181b; color: #f4f4f5; font-family: 'Segoe UI Variable', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { background: #1f1f23; border: 1px solid #27272a; border-radius: 10px; padding: 32px; text-align: center; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
  h2 { margin-top: 0; color: #38bdf8; }
  p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
  button { background: #0ea5e9; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 16px; }
  button:hover { background: #0284c7; }
</style>
</head>
<body>
  <div class='card'>
    <h2>Connecting to DgodTerm Core...</h2>
    <p>The secure automation daemon is launching on 127.0.0.1:5188. Reconnecting automatically...</p>
    <button onclick='window.location.href=""http://127.0.0.1:5188""'>Retry Connection</button>
  </div>
  <script>setTimeout(() => { window.location.href = 'http://127.0.0.1:5188'; }, 800);</script>
</body>
</html>");
                }
                else
                {
                    Log($"Navigating WebView2 to: {ServerUrl}");
                    MainWebView.CoreWebView2.Navigate(ServerUrl);
                }
            }
            catch (Exception ex)
            {
                Log($"WebView2 initialization exception: {ex}");
                System.Windows.MessageBox.Show(
                    $"Failed to initialize native WebView2 environment:\n{ex.Message}\n\nPlease ensure Microsoft Edge WebView2 Runtime is installed.",
                    "DgodTerm Error",
                    System.Windows.MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }

        private static readonly object _logLock = new object();
        private static void Log(string message)
        {
            try
            {
                string logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DgodTerm");
                Directory.CreateDirectory(logDir);
                string logFile = Path.Combine(logDir, "native-log.txt");
                lock (_logLock)
                {
                    File.AppendAllText(logFile, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}{Environment.NewLine}");
                }
            }
            catch { }
        }

        private static async Task<bool> CheckBackendReadyAsync()
        {
            try
            {
                using var tcp = new System.Net.Sockets.TcpClient();
                var connectTask = tcp.ConnectAsync("127.0.0.1", 5188);
                var completed = await Task.WhenAny(connectTask, Task.Delay(120));
                if (completed == connectTask && tcp.Connected)
                {
                    Log("CheckBackendReadyAsync: TCP connection succeeded on 127.0.0.1:5188.");
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        private void StartBackendProcess()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] serverCandidates = new[]
                {
                    Path.Combine(baseDir, "dist", "server", "web-server.js"),
                    Path.Combine(baseDir, "..", "..", "..", "..", "dist", "server", "web-server.js"),
                    Path.Combine(Directory.GetCurrentDirectory(), "dist", "server", "web-server.js")
                };

                string? serverScript = null;
                foreach (var candidate in serverCandidates)
                {
                    string fullPath = Path.GetFullPath(candidate);
                    if (File.Exists(fullPath))
                    {
                        serverScript = fullPath;
                        break;
                    }
                }

                if (serverScript == null)
                {
                    Log("[DgodTerm.Windows] Server script not found among candidates.");
                    return;
                }

                string workingDir = Path.GetDirectoryName(Path.GetDirectoryName(Path.GetDirectoryName(serverScript)))!;
                if (!Directory.Exists(workingDir))
                {
                    workingDir = baseDir;
                }

                string nodeExe = FindNodeExecutable(baseDir);

                Log($"Starting backend: {nodeExe} \"{serverScript}\" in {workingDir}");

                var startInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{serverScript}\"",
                    WorkingDirectory = workingDir,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false,
                    RedirectStandardError = true,
                    RedirectStandardOutput = true
                };

                string localModules = Path.Combine(baseDir, "node_modules");
                if (Directory.Exists(localModules))
                {
                    startInfo.EnvironmentVariables["NODE_PATH"] = localModules;
                }

                _backendProcess = new Process { StartInfo = startInfo };
                _backendProcess.OutputDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Log($"[Backend Output] {e.Data}"); };
                _backendProcess.ErrorDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Log($"[Backend Error] {e.Data}"); };
                _backendProcess.Start();
                _backendProcess.BeginOutputReadLine();
                _backendProcess.BeginErrorReadLine();

                Log($"Headless backend service spawned (PID: {_backendProcess.Id}).");
            }
            catch (Exception ex)
            {
                Log($"Failed to start backend service: {ex}");
            }
        }

        private static string FindNodeExecutable(string baseDir)
        {
            string bundledNode = Path.Combine(baseDir, "node.exe");
            if (File.Exists(bundledNode)) return bundledNode;

            string pfNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            if (File.Exists(pfNode)) return pfNode;

            string pf86Node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe");
            if (File.Exists(pf86Node)) return pf86Node;

            string localNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "node", "node.exe");
            if (File.Exists(localNode)) return localNode;

            var pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathEnv))
            {
                foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
                {
                    try
                    {
                        string candidate = Path.Combine(dir.Trim('\"'), "node.exe");
                        if (File.Exists(candidate)) return candidate;
                    }
                    catch { }
                }
            }

            return "node.exe";
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                using var doc = JsonDocument.Parse(e.WebMessageAsJson);
                if (doc.RootElement.TryGetProperty("type", out var typeProp))
                {
                    string? type = typeProp.GetString();
                    switch (type)
                    {
                        case "tabs:sync":
                            if (doc.RootElement.TryGetProperty("payload", out var payload))
                            {
                                SyncTabsFromWeb(payload);
                            }
                            break;
                        case "ui-settings:sync":
                            if (doc.RootElement.TryGetProperty("payload", out var uiPayload))
                            {
                                UpdateUiSettingsFromWeb(uiPayload);
                            }
                            break;
                        case "window:minimize":
                            WindowState = WindowState.Minimized;
                            break;
                        case "window:maximize":
                            WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
                            break;
                        case "window:close":
                            Close();
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[DgodTerm.Windows] Web message parse error: {ex.Message}");
            }
        }

        private void SyncTabsFromWeb(JsonElement payload)
        {
            Dispatcher.Invoke(() =>
            {
                try
                {
                    if (payload.TryGetProperty("tabStyle", out var styleEl) && styleEl.ValueKind == JsonValueKind.String)
                    {
                        string? st = styleEl.GetString();
                        if (!string.IsNullOrEmpty(st)) _currentTabStyle = st;
                    }
                    if (payload.TryGetProperty("accentColor", out var accentEl) && accentEl.ValueKind == JsonValueKind.String)
                    {
                        string? ac = accentEl.GetString();
                        if (!string.IsNullOrEmpty(ac)) _currentAccentColor = ac;
                    }

                    if (payload.TryGetProperty("tabs", out var tabsArray) && tabsArray.ValueKind == JsonValueKind.Array)
                    {
                        var incomingTabs = new List<NativeTabItem>();
                        string? activeId = payload.TryGetProperty("activeTabId", out var act) ? act.GetString() : null;

                        foreach (var item in tabsArray.EnumerateArray())
                        {
                            string id = item.GetProperty("id").GetString() ?? "";
                            string type = item.TryGetProperty("type", out var tp) ? tp.GetString() ?? "terminal" : "terminal";
                            string title = item.TryGetProperty("title", out var tl) ? tl.GetString() ?? "Tab" : "Tab";
                            bool canClose = type != "dashboard";

                            var newTab = new NativeTabItem
                            {
                                Id = id,
                                Type = type,
                                Title = title,
                                IsActive = (id == activeId),
                                CanClose = canClose,
                                TabStyle = _currentTabStyle,
                                ThemeAccentColor = _currentAccentColor,
                                ThemeBackgroundColor = _currentBackgroundColor,
                                ThemeForegroundColor = _currentForegroundColor
                            };
                            newTab.UpdateVisualPresentation();
                            incomingTabs.Add(newTab);
                        }

                        // Reconcile with existing Tabs
                        var existingMap = Tabs.ToDictionary(t => t.Id);
                        var newIds = incomingTabs.Select(t => t.Id).ToHashSet();

                        for (int i = Tabs.Count - 1; i >= 0; i--)
                        {
                            if (!newIds.Contains(Tabs[i].Id))
                            {
                                Tabs.RemoveAt(i);
                            }
                        }

                        for (int i = 0; i < incomingTabs.Count; i++)
                        {
                            var inc = incomingTabs[i];
                            if (existingMap.TryGetValue(inc.Id, out var existing))
                            {
                                existing.Title = inc.Title;
                                existing.Type = inc.Type;
                                existing.IsActive = inc.IsActive;
                                existing.CanClose = inc.CanClose;
                                existing.TabStyle = _currentTabStyle;
                                existing.ThemeAccentColor = _currentAccentColor;
                                existing.ThemeBackgroundColor = _currentBackgroundColor;
                                existing.ThemeForegroundColor = _currentForegroundColor;
                                existing.UpdateVisualPresentation();
                            }
                            else
                            {
                                Tabs.Insert(Math.Min(i, Tabs.Count), inc);
                            }
                        }

                        UpdateTabStripDimensions();
                        ScrollActiveTabIntoView();
                    }
                }
                catch (Exception ex)
                {
                    Log($"[SyncTabsFromWeb error]: {ex.Message}");
                }
            });
        }

        private void UpdateUiSettingsFromWeb(JsonElement payload)
        {
            Dispatcher.Invoke(() =>
            {
                try
                {
                    if (payload.TryGetProperty("tabStyle", out var styleEl) && styleEl.ValueKind == JsonValueKind.String)
                    {
                        string? st = styleEl.GetString();
                        if (!string.IsNullOrEmpty(st)) _currentTabStyle = st;
                    }
                    if (payload.TryGetProperty("accentColor", out var accentEl) && accentEl.ValueKind == JsonValueKind.String)
                    {
                        string? ac = accentEl.GetString();
                        if (!string.IsNullOrEmpty(ac)) _currentAccentColor = ac;
                    }
                    if (payload.TryGetProperty("customAccent", out var customAccentEl) && customAccentEl.ValueKind == JsonValueKind.String)
                    {
                        string? ca = customAccentEl.GetString();
                        if (!string.IsNullOrEmpty(ca)) _currentAccentColor = ca;
                    }
                    if (payload.TryGetProperty("customBackground", out var customBgEl) && customBgEl.ValueKind == JsonValueKind.String)
                    {
                        string? cb = customBgEl.GetString();
                        if (!string.IsNullOrEmpty(cb)) _currentBackgroundColor = cb;
                    }
                    if (payload.TryGetProperty("customForeground", out var customFgEl) && customFgEl.ValueKind == JsonValueKind.String)
                    {
                        string? cf = customFgEl.GetString();
                        if (!string.IsNullOrEmpty(cf)) _currentForegroundColor = cf;
                    }

                    // Update Native TitleBar, Buttons & Brand Badge Colors
                    try
                    {
                        var bgBrush = NativeTabItem.ResolveBrush(_currentBackgroundColor);
                        var fgBrush = NativeTabItem.ResolveBrush(_currentForegroundColor);
                        var acBrush = NativeTabItem.ResolveBrush(_currentAccentColor);

                        bool isLight = false;
                        if (bgBrush is System.Windows.Media.SolidColorBrush sBg)
                        {
                            var c = sBg.Color;
                            double luminance = (0.299 * c.R + 0.587 * c.G + 0.114 * c.B);
                            isLight = luminance > 140;
                        }

                        // Toggle DWM Immersive Dark Mode attribute so native caption controls (Min, Max, Close) adjust
                        try
                        {
                            int darkMode = isLight ? 0 : 1;
                            var helper = new WindowInteropHelper(this);
                            if (helper.Handle != IntPtr.Zero)
                            {
                                DwmSetWindowAttribute(helper.Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));
                            }
                        }
                        catch { }

                        if (BrandBadgeBorder != null) BrandBadgeBorder.Background = acBrush;
                        if (BrandTitleText != null) BrandTitleText.Foreground = fgBrush;

                        if (bgBrush is System.Windows.Media.SolidColorBrush solidBg)
                        {
                            var c = solidBg.Color;
                            byte r = isLight ? (byte)Math.Max(0, c.R - 8) : (byte)Math.Max(0, c.R - 10);
                            byte g = isLight ? (byte)Math.Max(0, c.G - 8) : (byte)Math.Max(0, c.G - 10);
                            byte b = isLight ? (byte)Math.Max(0, c.B - 8) : (byte)Math.Max(0, c.B - 10);
                            var barBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(r, g, b));
                            barBrush.Freeze();
                            if (TitleBarBorder != null) TitleBarBorder.Background = barBrush;
                            if (RootGrid != null) RootGrid.Background = barBrush;

                            // Elevation surface brush for title bar pills
                            byte sr = isLight ? (byte)Math.Max(0, c.R - 16) : (byte)Math.Min(255, c.R + 14);
                            byte sg = isLight ? (byte)Math.Max(0, c.G - 16) : (byte)Math.Min(255, c.G + 14);
                            byte sb = isLight ? (byte)Math.Max(0, c.B - 16) : (byte)Math.Min(255, c.B + 14);
                            var surfaceBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(sr, sg, sb));
                            surfaceBrush.Freeze();

                            // Border brush
                            byte br = isLight ? (byte)Math.Max(0, c.R - 38) : (byte)Math.Min(255, c.R + 25);
                            byte bg_ = isLight ? (byte)Math.Max(0, c.G - 38) : (byte)Math.Min(255, c.G + 25);
                            byte bb = isLight ? (byte)Math.Max(0, c.B - 38) : (byte)Math.Min(255, c.B + 25);
                            var borderBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(br, bg_, bb));
                            borderBrush.Freeze();

                            if (AddTabBorder != null) { AddTabBorder.Background = surfaceBrush; AddTabBorder.BorderBrush = borderBrush; }
                            if (CommandDockBorder != null) { CommandDockBorder.Background = surfaceBrush; CommandDockBorder.BorderBrush = borderBrush; }
                            if (SystemUtilityBorder != null) { SystemUtilityBorder.Background = surfaceBrush; SystemUtilityBorder.BorderBrush = borderBrush; }
                        }

                        if (QuickConnectBorder != null) QuickConnectBorder.Background = acBrush;

                        UpdateElementTreeForeground(CommandDockBorder, fgBrush);
                        UpdateElementTreeForeground(SystemUtilityBorder, fgBrush);
                        if (BtnAddTabIcon != null) BtnAddTabIcon.Foreground = fgBrush;
                        if (BtnTabsOverviewIcon != null) BtnTabsOverviewIcon.Foreground = fgBrush;
                    }
                    catch { }

                    foreach (var tab in Tabs)
                    {
                        tab.TabStyle = _currentTabStyle;
                        tab.ThemeAccentColor = _currentAccentColor;
                        tab.ThemeBackgroundColor = _currentBackgroundColor;
                        tab.ThemeForegroundColor = _currentForegroundColor;
                        tab.UpdateVisualPresentation();
                    }

                    UpdateTabStripDimensions();
                }
                catch (Exception ex)
                {
                    Log($"[UpdateUiSettingsFromWeb error]: {ex.Message}");
                }
            });
        }

        private void MainWindow_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            UpdateTabStripDimensions();
        }

        private void UpdateTabStripDimensions()
        {
            if (TabScrollViewer == null) return;

            // Bound TabScrollViewer using TabStripHostGrid so the '+' and 'v' buttons hug the last tab
            // while still shrinking tabs elastically when many tabs are open.
            double hostWidth = (TabStripHostGrid != null && TabStripHostGrid.ActualWidth > 0)
                ? TabStripHostGrid.ActualWidth - 96
                : Math.Max(140, ActualWidth - 820);
            double availableWidth = Math.Max(120, hostWidth);
            TabScrollViewer.MaxWidth = availableWidth;

            if (Tabs.Count == 0) return;

            // Elastic tab compression:
            // Shrinks proportionally as tabs count grows, down to 48px
            double targetWidth = Math.Clamp(availableWidth / Math.Max(1, Tabs.Count), 48, 175);
            foreach (var tab in Tabs)
            {
                tab.TabWidth = targetWidth;
            }

            if (BtnScrollLeft != null && BtnScrollRight != null)
            {
                BtnScrollLeft.Visibility = TabScrollViewer.HorizontalOffset > 1 ? Visibility.Visible : Visibility.Collapsed;
                BtnScrollRight.Visibility = TabScrollViewer.HorizontalOffset < (TabScrollViewer.ScrollableWidth - 1) ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        private void ScrollActiveTabIntoView()
        {
            Dispatcher.InvokeAsync(() =>
            {
                int activeIndex = -1;
                for (int i = 0; i < Tabs.Count; i++)
                {
                    if (Tabs[i].IsActive) { activeIndex = i; break; }
                }
                if (activeIndex >= 0 && TabStripItemsControl != null)
                {
                    var container = TabStripItemsControl.ItemContainerGenerator.ContainerFromIndex(activeIndex) as FrameworkElement;
                    container?.BringIntoView();
                }
            }, System.Windows.Threading.DispatcherPriority.Background);
        }

        private void TabScrollViewer_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
        {
            if (TabScrollViewer != null)
            {
                TabScrollViewer.ScrollToHorizontalOffset(TabScrollViewer.HorizontalOffset - e.Delta);
                e.Handled = true;
            }
        }

        private void TabScrollViewer_ScrollChanged(object sender, ScrollChangedEventArgs e)
        {
            if (BtnScrollLeft != null && BtnScrollRight != null && TabScrollViewer != null)
            {
                BtnScrollLeft.Visibility = TabScrollViewer.HorizontalOffset > 1 ? Visibility.Visible : Visibility.Collapsed;
                BtnScrollRight.Visibility = TabScrollViewer.HorizontalOffset < (TabScrollViewer.ScrollableWidth - 1) ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        private void TabScrollViewer_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            UpdateTabStripDimensions();
        }

        private void BtnScrollLeft_Click(object sender, RoutedEventArgs e)
        {
            if (TabScrollViewer != null)
            {
                TabScrollViewer.ScrollToHorizontalOffset(Math.Max(0, TabScrollViewer.HorizontalOffset - 120));
            }
        }

        private void BtnScrollRight_Click(object sender, RoutedEventArgs e)
        {
            if (TabScrollViewer != null)
            {
                TabScrollViewer.ScrollToHorizontalOffset(TabScrollViewer.HorizontalOffset + 120);
            }
        }

        private void BtnTabsOverview_Click(object sender, RoutedEventArgs e)
        {
            TabsOverviewContextMenu.Items.Clear();

            var headerItem = new Wpf.Ui.Controls.MenuItem
            {
                Header = $"Active Tabs ({Tabs.Count})",
                IsEnabled = false,
                FontWeight = FontWeights.Bold,
                Foreground = System.Windows.Media.Brushes.SlateGray
            };
            TabsOverviewContextMenu.Items.Add(headerItem);
            TabsOverviewContextMenu.Items.Add(new Separator { Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0x1e, 0x29, 0x3b)) });

            foreach (var tab in Tabs)
            {
                var mi = new Wpf.Ui.Controls.MenuItem
                {
                    Header = tab.Title,
                    FontWeight = tab.IsActive ? FontWeights.SemiBold : FontWeights.Normal,
                    Foreground = tab.IsActive ? System.Windows.Media.Brushes.White : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xcb, 0xd5, 0xe1))
                };
                try
                {
                    var icon = new SymbolIcon
                    {
                        Symbol = tab.Symbol,
                        Foreground = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(tab.AccentColor))
                    };
                    mi.Icon = icon;
                }
                catch { }

                string tabId = tab.Id;
                mi.Click += (s, args) =>
                {
                    foreach (var t in Tabs)
                    {
                        t.IsActive = (t.Id == tabId);
                    }
                    SendMessageToWeb("tab:activate", tabId);
                    ScrollActiveTabIntoView();
                };
                TabsOverviewContextMenu.Items.Add(mi);
            }

            if (BtnTabsOverview.ContextMenu != null)
            {
                BtnTabsOverview.ContextMenu.PlacementTarget = BtnTabsOverview;
                BtnTabsOverview.ContextMenu.IsOpen = true;
            }
        }

        public void SendMessageToWeb(string type, object? payload = null)
        {
            if (MainWebView?.CoreWebView2 == null) return;
            var msg = new { type, payload };
            string json = JsonSerializer.Serialize(msg);
            MainWebView.CoreWebView2.PostWebMessageAsJson(json);
        }

        private void MainWindow_Closed(object? sender, EventArgs e)
        {
            try
            {
                if (_backendProcess != null && !_backendProcess.HasExited)
                {
                    _backendProcess.Kill(true);
                    _backendProcess.Dispose();
                }
            }
            catch { }
        }

        // ==========================================
        // Native Tab Click Handlers
        // ==========================================

        private void OnTabClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement fe && fe.DataContext is NativeTabItem tab)
            {
                foreach (var t in Tabs)
                {
                    t.IsActive = (t.Id == tab.Id);
                }
                SendMessageToWeb("tab:activate", tab.Id);
                ScrollActiveTabIntoView();
            }
        }

        private void OnTabMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Middle)
            {
                if (sender is FrameworkElement fe && fe.DataContext is NativeTabItem tab && tab.CanClose)
                {
                    SendMessageToWeb("tab:close", tab.Id);
                }
            }
        }

        private void OnTabCloseClick(object sender, MouseButtonEventArgs e)
        {
            e.Handled = true;
            if (sender is FrameworkElement fe && fe.DataContext is NativeTabItem tab && tab.CanClose)
            {
                SendMessageToWeb("tab:close", tab.Id);
            }
        }

        private void BtnAddTab_Click(object sender, RoutedEventArgs e)
        {
            if (BtnAddTab.ContextMenu != null)
            {
                BtnAddTab.ContextMenu.PlacementTarget = BtnAddTab;
                BtnAddTab.ContextMenu.IsOpen = true;
            }
        }

        // ==========================================
        // TitleBar & Ribbon Command Handlers
        // ==========================================

        private void MenuQuickConnect_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:quick-connect");

        private void MenuNewProfile_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:new-profile");

        private void MenuNewPowerShell_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("tab:new", "powershell");

        private void MenuNewCmd_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("tab:new", "cmd");

        private void MenuNewWsl_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("tab:new", "wsl");

        private void MenuNewBash_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("tab:new", "bash");

        private void MenuOpenSftp_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:open-sftp");

        private void MenuOpenAnsible_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:open-ansible");

        private void MenuOpenAudit_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:open-audit");

        private void MenuOpenTrust_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:open-trust");

        private void MenuToggleSidebar_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:toggle-sidebar");

        private void MenuLockWorkstation_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:lock-workstation");

        private void MenuSettings_Click(object sender, RoutedEventArgs e) =>
            SendMessageToWeb("menu:open-settings");

        private static void UpdateElementTreeForeground(DependencyObject? parent, System.Windows.Media.Brush brush)
        {
            if (parent == null) return;
            int count = System.Windows.Media.VisualTreeHelper.GetChildrenCount(parent);
            for (int i = 0; i < count; i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(parent, i);
                if (child is System.Windows.Controls.TextBlock tb) tb.Foreground = brush;
                else if (child is Wpf.Ui.Controls.TextBlock utb) utb.Foreground = brush;
                else if (child is Wpf.Ui.Controls.SymbolIcon si) si.Foreground = brush;
                else if (child is Border b && b.Width == 1) b.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromArgb(0x35, 0x88, 0x88, 0x88));
                UpdateElementTreeForeground(child, brush);
            }
        }
    }
}
