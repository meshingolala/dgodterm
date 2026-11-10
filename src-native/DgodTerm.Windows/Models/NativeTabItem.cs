using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Media;
using Wpf.Ui.Controls;

namespace DgodTerm.Windows.Models
{
    public class NativeTabItem : INotifyPropertyChanged
    {
        private string _id = string.Empty;
        private string _type = "terminal";
        private string _title = "New Tab";
        private string _subtitle = string.Empty;
        private bool _isActive;
        private bool _canClose = true;
        private SymbolRegular _symbol = SymbolRegular.WindowConsole20;
        private string _accentColor = "#38bdf8"; // Tab icon accent color
        private double _tabWidth = 140;

        // Visual Presentation Settings
        private string _tabStyle = "rounded"; // 'rounded' | 'modern' | 'minimal'
        private string _themeAccentColor = "#E78A4E";
        private string _themeBackgroundColor = "#2D2F30";
        private string _themeForegroundColor = "#D4BE98";

        private double _tabHeight = 32;
        private Thickness _tabMargin = new Thickness(1, 2, 1, 0);
        private CornerRadius _tabCornerRadius = new CornerRadius(6, 6, 0, 0);
        private Thickness _currentBorderThickness = new Thickness(1, 1, 1, 0);
        private Brush _currentBorderBrush = Brushes.Transparent;
        private Brush _currentBackground = Brushes.Transparent;
        private Brush _titleForeground = new SolidColorBrush(Color.FromRgb(0x94, 0xa3, 0xb8));
        private FontWeight _titleFontWeight = FontWeights.Normal;

        public double TabWidth
        {
            get => _tabWidth;
            set { _tabWidth = value; OnPropertyChanged(); }
        }

        public string Id
        {
            get => _id;
            set { _id = value; OnPropertyChanged(); }
        }

        public string Type
        {
            get => _type;
            set
            {
                _type = value;
                UpdateSymbolAndColor();
                OnPropertyChanged();
            }
        }

        public string Title
        {
            get => _title;
            set { _title = value; OnPropertyChanged(); }
        }

        public string Subtitle
        {
            get => _subtitle;
            set { _subtitle = value; OnPropertyChanged(); }
        }

        public bool IsActive
        {
            get => _isActive;
            set
            {
                if (_isActive != value)
                {
                    _isActive = value;
                    OnPropertyChanged();
                    UpdateVisualPresentation();
                }
            }
        }

        public bool CanClose
        {
            get => _canClose;
            set { _canClose = value; OnPropertyChanged(); }
        }

        public SymbolRegular Symbol
        {
            get => _symbol;
            set { _symbol = value; OnPropertyChanged(); }
        }

        public string AccentColor
        {
            get => _accentColor;
            set { _accentColor = value; OnPropertyChanged(); }
        }

        public string TabStyle
        {
            get => _tabStyle;
            set
            {
                if (_tabStyle != value)
                {
                    _tabStyle = value;
                    OnPropertyChanged();
                    UpdateVisualPresentation();
                }
            }
        }

        public string ThemeAccentColor
        {
            get => _themeAccentColor;
            set
            {
                if (_themeAccentColor != value)
                {
                    _themeAccentColor = value;
                    OnPropertyChanged();
                    UpdateVisualPresentation();
                }
            }
        }

        public string ThemeBackgroundColor
        {
            get => _themeBackgroundColor;
            set
            {
                if (_themeBackgroundColor != value)
                {
                    _themeBackgroundColor = value;
                    OnPropertyChanged();
                    UpdateVisualPresentation();
                }
            }
        }

        public string ThemeForegroundColor
        {
            get => _themeForegroundColor;
            set
            {
                if (_themeForegroundColor != value)
                {
                    _themeForegroundColor = value;
                    OnPropertyChanged();
                    UpdateVisualPresentation();
                }
            }
        }

        public double TabHeight
        {
            get => _tabHeight;
            private set { _tabHeight = value; OnPropertyChanged(); }
        }

        public Thickness TabMargin
        {
            get => _tabMargin;
            private set { _tabMargin = value; OnPropertyChanged(); }
        }

        public CornerRadius TabCornerRadius
        {
            get => _tabCornerRadius;
            private set { _tabCornerRadius = value; OnPropertyChanged(); }
        }

        public Thickness CurrentBorderThickness
        {
            get => _currentBorderThickness;
            private set { _currentBorderThickness = value; OnPropertyChanged(); }
        }

        public Brush CurrentBorderBrush
        {
            get => _currentBorderBrush;
            private set { _currentBorderBrush = value; OnPropertyChanged(); }
        }

        public Brush CurrentBackground
        {
            get => _currentBackground;
            private set { _currentBackground = value; OnPropertyChanged(); }
        }

        public Brush TitleForeground
        {
            get => _titleForeground;
            private set { _titleForeground = value; OnPropertyChanged(); }
        }

        public FontWeight TitleFontWeight
        {
            get => _titleFontWeight;
            private set { _titleFontWeight = value; OnPropertyChanged(); }
        }

        public static Brush ResolveBrush(string colorOrHex)
        {
            string hex = colorOrHex?.ToLowerInvariant() switch
            {
                "sky" => "#38bdf8",
                "indigo" => "#6366f1",
                "emerald" => "#10b981",
                "rose" => "#f43f5e",
                "amber" => "#f59e0b",
                "cyan" => "#06b6d4",
                _ => string.IsNullOrEmpty(colorOrHex) ? "#38bdf8" : colorOrHex
            };

            try
            {
                if (!hex.StartsWith("#")) hex = "#" + hex;
                var color = (Color)ColorConverter.ConvertFromString(hex);
                var brush = new SolidColorBrush(color);
                brush.Freeze();
                return brush;
            }
            catch
            {
                var fallback = new SolidColorBrush(Color.FromRgb(0x38, 0xbd, 0xf8));
                fallback.Freeze();
                return fallback;
            }
        }

        public void UpdateVisualPresentation()
        {
            var accentBrush = ResolveBrush(_themeAccentColor);
            var activeBgBrush = ResolveBrush(_themeBackgroundColor);
            var activeFgBrush = ResolveBrush(_themeForegroundColor);

            bool isLight = false;
            if (activeBgBrush is SolidColorBrush sBg)
            {
                var c = sBg.Color;
                double luminance = (0.299 * c.R + 0.587 * c.G + 0.114 * c.B);
                isLight = luminance > 140;
            }

            if (_tabStyle == "modern")
            {
                // Modern Floating Cards (Windows 11 Fluent)
                TabHeight = 28;
                TabMargin = new Thickness(2, 4, 2, 4);
                TabCornerRadius = new CornerRadius(6);

                if (_isActive)
                {
                    CurrentBorderThickness = new Thickness(1);
                    CurrentBorderBrush = accentBrush;
                    CurrentBackground = activeBgBrush;
                    TitleForeground = activeFgBrush;
                    TitleFontWeight = FontWeights.SemiBold;
                }
                else
                {
                    CurrentBorderThickness = new Thickness(1);
                    var border = isLight ? new SolidColorBrush(Color.FromArgb(0x40, 0x80, 0x75, 0x65)) : new SolidColorBrush(Color.FromRgb(0x38, 0x36, 0x34));
                    border.Freeze();
                    CurrentBorderBrush = border;
                    var bg = isLight ? new SolidColorBrush(Color.FromArgb(0x20, 0, 0, 0)) : new SolidColorBrush(Color.FromArgb(0x60, 0x1e, 0x1e, 0x1e));
                    bg.Freeze();
                    CurrentBackground = bg;
                    var fg = isLight ? new SolidColorBrush(Color.FromRgb(0x70, 0x65, 0x55)) : new SolidColorBrush(Color.FromRgb(0x9a, 0x92, 0x84));
                    fg.Freeze();
                    TitleForeground = fg;
                    TitleFontWeight = FontWeights.Normal;
                }
            }
            else if (_tabStyle == "minimal")
            {
                // Minimal Underline
                TabHeight = 32;
                TabMargin = new Thickness(0, 0, 0, 0);
                TabCornerRadius = new CornerRadius(0);

                if (_isActive)
                {
                    CurrentBorderThickness = new Thickness(0, 0, 0, 2);
                    CurrentBorderBrush = accentBrush;
                    CurrentBackground = activeBgBrush;
                    TitleForeground = activeFgBrush;
                    TitleFontWeight = FontWeights.SemiBold;
                }
                else
                {
                    CurrentBorderThickness = new Thickness(0, 0, 0, 2);
                    CurrentBorderBrush = Brushes.Transparent;
                    CurrentBackground = Brushes.Transparent;
                    var fg = isLight ? new SolidColorBrush(Color.FromRgb(0x70, 0x65, 0x55)) : new SolidColorBrush(Color.FromRgb(0x9a, 0x92, 0x84));
                    fg.Freeze();
                    TitleForeground = fg;
                    TitleFontWeight = FontWeights.Normal;
                }
            }
            else
            {
                // Antigravity Rounded Top Tabs (Default)
                TabHeight = 32;
                TabMargin = new Thickness(1, 2, 1, 0);
                TabCornerRadius = new CornerRadius(6, 6, 0, 0);

                if (_isActive)
                {
                    CurrentBorderThickness = new Thickness(1, 2, 1, 0);
                    CurrentBorderBrush = accentBrush;
                    CurrentBackground = activeBgBrush;
                    TitleForeground = activeFgBrush;
                    TitleFontWeight = FontWeights.SemiBold;
                }
                else
                {
                    CurrentBorderThickness = new Thickness(1, 1, 1, 0);
                    CurrentBorderBrush = Brushes.Transparent;
                    CurrentBackground = Brushes.Transparent;
                    var fg = isLight ? new SolidColorBrush(Color.FromRgb(0x70, 0x65, 0x55)) : new SolidColorBrush(Color.FromRgb(0xa8, 0x99, 0x84));
                    fg.Freeze();
                    TitleForeground = fg;
                    TitleFontWeight = FontWeights.Normal;
                }
            }
        }

        private void UpdateSymbolAndColor()
        {
            switch (_type)
            {
                case "dashboard":
                    Symbol = SymbolRegular.Grid20;
                    AccentColor = "#38bdf8";
                    CanClose = false;
                    break;
                case "sftp":
                    Symbol = SymbolRegular.FolderSwap20;
                    AccentColor = "#34d399"; // Emerald-400
                    break;
                case "ansible":
                    Symbol = SymbolRegular.Bot20;
                    AccentColor = "#818cf8"; // Indigo-400
                    break;
                case "audit":
                    Symbol = SymbolRegular.ShieldCheckmark20;
                    AccentColor = "#38bdf8";
                    break;
                case "trust":
                    Symbol = SymbolRegular.Key20;
                    AccentColor = "#34d399";
                    break;
                case "settings":
                    Symbol = SymbolRegular.Settings20;
                    AccentColor = "#c084fc"; // Purple-400
                    break;
                case "vault":
                    Symbol = SymbolRegular.LockClosed20;
                    AccentColor = "#fbbf24"; // Amber-400
                    break;
                case "tunnels":
                    Symbol = SymbolRegular.ArrowRouting20;
                    AccentColor = "#c084fc";
                    break;
                default:
                    Symbol = SymbolRegular.WindowConsole20;
                    AccentColor = "#38bdf8";
                    break;
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
