using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public sealed class WindowsBarHost : IBarWindowHost {
  readonly string edge, profile, url, title, propertyKey;
  Process launchProcess;
  public bool LaunchFailed { get { return launchProcess != null && launchProcess.HasExited && launchProcess.ExitCode != 0; } }
  public WindowsBarHost(string edge, string profile, int port) {
    this.edge = edge; this.profile = profile;
    Directory.CreateDirectory(profile);
    string marker = Path.Combine(profile, "window-id");
    string id = File.Exists(marker) ? File.ReadAllText(marker).Trim() : "";
    Guid parsed;
    if (!Guid.TryParseExact(id, "N", out parsed)) { id = Guid.NewGuid().ToString("N"); File.WriteAllText(marker, id); }
    title = "Windows Search [" + port + "] " + id;
    propertyKey = "WindowsSearch.Owner." + id;
    url = "http://127.0.0.1:" + port + "/?native=1&windowId=" + id;
  }
  public IntPtr Foreground { get { return GetForegroundWindow(); } }
  public bool Exists(IntPtr window) { return IsWindow(window); }
  public bool Visible(IntPtr window) { return IsWindowVisible(window); }
  public IntPtr FindWindow() {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr window, IntPtr ignored) {
      var text = new StringBuilder(512); GetWindowText(window, text, text.Capacity);
      bool tagged = GetProp(window, propertyKey) == (IntPtr)1;
      if (!tagged && text.ToString() != title) return true;
      uint pid; GetWindowThreadProcessId(window, out pid);
      try {
        using (var process = Process.GetProcessById((int)pid)) {
          if (!String.Equals(process.MainModule.FileName, edge, StringComparison.OrdinalIgnoreCase)) return true;
        }
      } catch { return true; }
      if (!tagged && !SetProp(window, propertyKey, (IntPtr)1)) return true;
      // The bootstrap identity belongs in a native property, not the visible caption.
      SetWindowText(window, "Windows Search");
      found = window; return false;
    }, IntPtr.Zero);
    if (found != IntPtr.Zero && launchProcess != null) { launchProcess.Dispose(); launchProcess = null; }
    return found;
  }
  public void Launch() {
    var start = new ProcessStartInfo(edge);
    start.Arguments = "--user-data-dir=\"" + profile + "\" --app=" + url + " --window-size=780,560";
    start.UseShellExecute = false;
    if (launchProcess != null) launchProcess.Dispose();
    launchProcess = Process.Start(start);
    if (launchProcess == null) throw new Exception("Edge did not start");
  }
  public void Show(IntPtr window, IntPtr anchor) {
    // Work area excludes taskbar and follows the previously active monitor.
    var info = new MonitorInfo(); info.size = Marshal.SizeOf(typeof(MonitorInfo));
    IntPtr monitor = MonitorFromWindow(anchor, 2);
    if (GetMonitorInfo(monitor, ref info)) {
      Rect bounds; GetWindowRect(window, out bounds);
      int width = Math.Min(Math.Max(bounds.right - bounds.left, 480), info.work.right - info.work.left);
      int height = Math.Min(Math.Max(bounds.bottom - bounds.top, 360), info.work.bottom - info.work.top);
      int x = info.work.left + (info.work.right - info.work.left - width) / 2;
      int y = info.work.top + Math.Max(0, (info.work.bottom - info.work.top - height) / 4);
      SetWindowPos(window, IntPtr.Zero, x, y, width, height, 0x14); // No z-order/focus change here.
    }
    ShowWindow(window, 9);
  }
  public void Hide(IntPtr window) { ShowWindow(window, 0); }
  public void Focus(IntPtr window) { if (!SetForegroundWindow(window)) Console.Error.WriteLine("Windows declined focus activation"); }
  delegate bool EnumProc(IntPtr window, IntPtr param);
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int left, top, right, bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int size; public Rect monitor, work; public uint flags; }
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetProp(IntPtr window, string name);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool SetProp(IntPtr window, string name, IntPtr value);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool SetWindowText(IntPtr window, string text);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int size);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
}

public static class SearchShimHook {
  delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
  static HookProc callback;
  static BarWindowController controller;
  static ShortcutPress keys = new ShortcutPress();
  static IntPtr hook;
  static uint thread;
  const uint Toggle = 0x8001, Dismiss = 0x8002;
  public static void Run(string edge, string profile, int port) {
    controller = new BarWindowController(new WindowsBarHost(edge, profile, port));
    thread = GetCurrentThreadId(); callback = OnKey;
    using (var process = Process.GetCurrentProcess()) using (var module = process.MainModule)
      hook = SetWindowsHookEx(13, callback, GetModuleHandle(module.ModuleName), 0);
    if (hook == IntPtr.Zero) throw new Exception("Keyboard hook registration failed");
    UIntPtr timer = SetTimer(IntPtr.Zero, UIntPtr.Zero, 50, IntPtr.Zero);
    try {
      if (timer == UIntPtr.Zero) throw new Exception("Window discovery timer failed");
      Console.WriteLine("Registered Win+S / Alt+Space; Escape dismisses the owned window");
      Message message;
      while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) {
        try {
          if (message.message == Toggle) controller.Toggle(Stopwatch.GetTimestamp() / (Stopwatch.Frequency / 1000));
          else if (message.message == Dismiss) controller.Dismiss();
          else if (message.message == 0x113) controller.Tick(Stopwatch.GetTimestamp() / (Stopwatch.Frequency / 1000));
          else { TranslateMessage(ref message); DispatchMessage(ref message); }
        } catch (Exception error) { Console.Error.WriteLine(error.Message); }
      }
    } finally { if (timer != UIntPtr.Zero) KillTimer(IntPtr.Zero, timer); UnhookWindowsHookEx(hook); }
  }
  static IntPtr OnKey(int code, IntPtr message, IntPtr data) {
    int msg = message.ToInt32();
    if (code >= 0 && (msg == 0x100 || msg == 0x104 || msg == 0x101 || msg == 0x105)) {
      int key = Marshal.ReadInt32(data); bool down = msg == 0x100 || msg == 0x104;
      bool shortcut = !Pressed(0x11) && !Pressed(0x10) && ((key == 0x53 && !Pressed(0x12) && (Pressed(0x5B) || Pressed(0x5C))) || (key == 0x20 && Pressed(0x12) && !Pressed(0x5B) && !Pressed(0x5C)));
      bool toggle, dismiss;
      if (keys.Consume(key, down, shortcut, controller.OwnsForeground, out toggle, out dismiss)) {
        if (toggle) PostThreadMessage(thread, Toggle, IntPtr.Zero, IntPtr.Zero);
        if (dismiss) PostThreadMessage(thread, Dismiss, IntPtr.Zero, IntPtr.Zero);
        return (IntPtr)1;
      }
    }
    return CallNextHookEx(hook, code, message, data);
  }
  static bool Pressed(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
  [StructLayout(LayoutKind.Sequential)] struct Message { public IntPtr hwnd; public uint message; public IntPtr wParam,lParam; public uint time; public int x,y; public uint privateData; }
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc callback, IntPtr module, uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern bool PostThreadMessage(uint thread, uint message, IntPtr w, IntPtr l);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
  [DllImport("user32.dll")] static extern int GetMessage(out Message message, IntPtr window, uint min, uint max);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref Message message);
  [DllImport("user32.dll")] static extern UIntPtr SetTimer(IntPtr window, UIntPtr id, uint interval, IntPtr callback);
  [DllImport("user32.dll")] static extern bool KillTimer(IntPtr window, UIntPtr timer);
}
