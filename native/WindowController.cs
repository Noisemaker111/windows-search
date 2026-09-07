using System;

public interface IBarWindowHost {
  IntPtr FindWindow();
  IntPtr Foreground { get; }
  bool Exists(IntPtr window);
  bool Visible(IntPtr window);
  void Launch();
  bool LaunchFailed { get; }
  void Show(IntPtr window, IntPtr anchor);
  void Hide(IntPtr window);
  void Focus(IntPtr window);
}

// No native calls: exercise lifecycle decisions without changing global shortcuts.
public sealed class BarWindowController {
  readonly IBarWindowHost host;
  IntPtr bar, previous;
  long openingUntil;
  bool opening;
  public BarWindowController(IBarWindowHost host) { this.host = host; }
  public bool OwnsForeground { get { return bar != IntPtr.Zero && host.Exists(bar) && host.Foreground == bar; } }
  public void Toggle(long now) {
    if (opening) return; // A slow Edge launch must not create duplicate windows.
    bar = host.FindWindow();
    if (OwnsForeground && host.Visible(bar)) { Dismiss(); return; }
    previous = host.Foreground;
    if (bar != IntPtr.Zero) { host.Show(bar, previous); host.Focus(bar); return; }
    opening = true; openingUntil = now + 5000;
    try { host.Launch(); } catch { opening = false; throw; }
  }
  public void Tick(long now) {
    if (!opening) return;
    bar = host.FindWindow();
    if (bar != IntPtr.Zero) {
      opening = false;
      // Do not retry activation over an app the user chose during startup.
      if (host.Foreground == previous || host.Foreground == bar) {
        host.Show(bar, previous); host.Focus(bar);
      }
    } else if (now >= openingUntil && host.LaunchFailed) opening = false;
    // A timeout alone does not prove Edge failed. Keep discovering the original
    // launch instead of creating a second window when startup is unusually slow.
  }
  public void Dismiss() {
    if (!OwnsForeground) return;
    host.Hide(bar);
    if (previous != IntPtr.Zero && previous != bar && host.Exists(previous)) host.Focus(previous);
  }
}

public sealed class ShortcutPress {
  bool s, space, escape;
  public bool Consume(int key, bool down, bool shortcut, bool ownsForeground, out bool toggle, out bool dismiss) {
    toggle = false; dismiss = false;
    if (key == 0x53 || key == 0x20) {
      bool held = key == 0x53 ? s : space;
      if (!down) { if (key == 0x53) s = false; else space = false; return held; }
      if (!shortcut && !held) return false;
      if (!held) { if (key == 0x53) s = true; else space = true; toggle = true; }
      return true;
    }
    if (key == 0x1B) {
      if (!down) { bool held = escape; escape = false; return held; }
      if (!ownsForeground && !escape) return false;
      if (!escape) { escape = true; dismiss = true; }
      return true;
    }
    return false;
  }
}
