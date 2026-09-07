using System;
using System.Collections.Generic;
public sealed class FakeBarHost : IBarWindowHost {
  public IntPtr Current = (IntPtr)11, Window;
  public bool IsVisible;
  public int Launches, Shows, Hides, Focuses;
  public bool Failed;
  public bool LaunchFailed { get { return Failed; } }
  public List<IntPtr> Dead = new List<IntPtr>();
  public IntPtr LastAnchor;
  public IntPtr Foreground { get { return Current; } }
  public IntPtr FindWindow() { return Window; }
  public bool Exists(IntPtr window) { return window != IntPtr.Zero && !Dead.Contains(window); }
  public bool Visible(IntPtr window) { return IsVisible; }
  public void Launch() { Launches++; }
  public void Show(IntPtr window, IntPtr anchor) { Shows++; IsVisible=true; LastAnchor=anchor; }
  public void Hide(IntPtr window) { Hides++; IsVisible=false; }
  public void Focus(IntPtr window) { Focuses++; Current=window; }
}
public static class NativeChecks {
  static void Expect(bool condition, string message) { if (!condition) throw new Exception(message); }
  public static int Run() {
    int count=0;
    var h=new FakeBarHost(); var c=new BarWindowController(h);
    c.Toggle(0); c.Toggle(500); c.Toggle(1500); Expect(h.Launches==1,"Slow launch duplicated window"); count++;
    h.Window=(IntPtr)22; c.Tick(2000); Expect(h.Shows==1 && h.Current==h.Window && h.LastAnchor==(IntPtr)11,"First open did not position/focus"); count++;
    c.Dismiss(); Expect(h.Hides==1 && h.Current==(IntPtr)11,"Dismiss did not restore previous app"); count++;
    h.Current=(IntPtr)33; c.Toggle(2100); Expect(h.Launches==1 && h.LastAnchor==(IntPtr)33,"Reopen launched twice or used wrong monitor anchor"); c.Toggle(2200); Expect(h.Current==(IntPtr)33 && !h.IsVisible,"Toggle did not dismiss"); count++;
    c.Toggle(2300); h.Dead.Add((IntPtr)33); int before=h.Focuses; c.Dismiss(); Expect(h.Focuses==before,"Restored a destroyed previous app"); count++;
    h.Current=(IntPtr)44; before=h.Hides; c.Dismiss(); Expect(h.Hides==before,"Dismiss affected another foreground app"); count++;
    h=new FakeBarHost(); c=new BarWindowController(h); c.Toggle(0); c.Tick(5001); c.Toggle(5002); Expect(h.Launches==1,"Timeout launched a duplicate while Edge was still starting"); h.Failed=true; c.Tick(5003); c.Toggle(5004); Expect(h.Launches==2,"Confirmed failed launch cannot retry"); count++;
    h=new FakeBarHost(); c=new BarWindowController(h); c.Toggle(0); h.Current=(IntPtr)33; h.Window=(IntPtr)22; c.Tick(10); Expect(h.Focuses==0,"Late window discovery stole focus"); count++;
    var keys=new ShortcutPress(); bool toggle,dismiss;
    Expect(keys.Consume(0x53,true,true,false,out toggle,out dismiss)&&toggle,"First Win+S not admitted");
    for(int i=0;i<100;i++) Expect(keys.Consume(0x53,true,true,false,out toggle,out dismiss)&&!toggle,"Held shortcut repeated");
    Expect(keys.Consume(0x53,false,false,false,out toggle,out dismiss),"Consumed chord key-up leaked");
    Expect(keys.Consume(0x53,true,true,false,out toggle,out dismiss)&&toggle,"New press not admitted"); count++;
    Expect(!keys.Consume(0x1B,true,false,false,out toggle,out dismiss),"Escape in another app consumed");
    Expect(keys.Consume(0x1B,true,false,true,out toggle,out dismiss)&&dismiss,"Escape did not request dismissal");
    Expect(keys.Consume(0x1B,true,false,false,out toggle,out dismiss)&&!dismiss,"Held Escape repeated after dismissal");
    Expect(keys.Consume(0x1B,false,false,false,out toggle,out dismiss),"Escape release leaked into previous app"); count++;
    keys=new ShortcutPress(); Expect(!keys.Consume(0x20,true,false,false,out toggle,out dismiss),"Ordinary space consumed");
    Expect(keys.Consume(0x20,true,true,false,out toggle,out dismiss)&&toggle,"Alt+Space not admitted"); count++;
    return count;
  }
}
