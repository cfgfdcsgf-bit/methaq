import { useEffect, useState } from "react";
import { Compass, Navigation } from "lucide-react";

type Orientation = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type PermissionApi = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
const delta = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export default function CompassDial({ bearing }: { bearing: number }) {
  const [active, setActive] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [rotation, setRotation] = useState(bearing);
  useEffect(() => { if (heading === null) setRotation(bearing); }, [bearing, heading]);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const onOrientation = (reading: Orientation) => {
      const apple = reading.webkitCompassHeading;
      if (typeof apple !== "number" && !reading.absolute) return;
      const reliable = typeof apple === "number" && (reading.webkitCompassAccuracy ?? 0) >= 0 && (reading.webkitCompassAccuracy ?? 0) <= 25;
      const raw = typeof apple === "number" ? (reliable ? apple : null) : reading.absolute && reading.alpha !== null ? (360 - reading.alpha) % 360 : null;
      if (raw === null || !Number.isFinite(raw) || Math.abs(reading.beta ?? 0) > 35 || Math.abs(reading.gamma ?? 0) > 35) {
        setHeading(null); setMessage("ضع الهاتف أفقيًا وابتعد عن المعادن أو الأجهزة المغناطيسية."); return;
      }
      const value = raw + (screen.orientation?.angle ?? 0);
      setHeading(value);
      setRotation(previous => previous + delta(bearing - value, previous));
      setMessage("");
      clearTimeout(timer);
      timer = setTimeout(() => { setHeading(null); setMessage("توقفت قراءة البوصلة. استخدم الزاوية من الشمال."); }, 2500);
    };
    timer = setTimeout(() => setMessage("لم تصل قراءة مطلقة من الهاتف. ما زالت زاوية القبلة من الشمال متاحة."), 3500);
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [active, bearing]);
  const activate = async () => {
    if (active) { setActive(false); setHeading(null); setMessage(""); return; }
    if (!window.isSecureContext || !("DeviceOrientationEvent" in window)) { setMessage("البوصلة الحية تحتاج هاتفًا يدعم المستشعر واتصالًا آمنًا."); return; }
    try {
      const permission = (window.DeviceOrientationEvent as PermissionApi).requestPermission;
      if (permission && await permission.call(window.DeviceOrientationEvent) !== "granted") throw new Error("permission");
      setActive(true); setMessage("جارٍ قراءة البوصلة…");
    } catch { setMessage("لم يُسمح باستخدام البوصلة. يمكنك الاستعانة بالزاوية من الشمال."); }
  };
  const aligned = heading !== null && Math.abs(delta(bearing, heading)) <= 5;
  return <section className="companion-panel qibla-card" id="qibla" aria-labelledby="qibla-title">
    <header className="companion-panel-head"><span className="launch-tile-icon"><Compass size={20} /></span><div><h2 id="qibla-title">اتجاه القبلة</h2><p>زاوية الاتجاه من الشمال</p></div></header>
    <div className={`qibla-dial${aligned ? " is-aligned" : ""}`} aria-hidden="true">
      <span className="qibla-dial-point">ش</span><span className="qibla-cardinal qibla-east">ق</span><span className="qibla-cardinal qibla-south">ج</span><span className="qibla-cardinal qibla-west">غ</span><Navigation size={54} style={{ transform: `rotate(${rotation - 45}deg)` }} />
    </div>
    <p>{aligned ? "الهاتف في اتجاه القبلة" : heading !== null ? "أدر الهاتف حتى يصل السهم إلى العلامة" : `${Math.round(bearing).toLocaleString("ar-EG")}° من الشمال باتجاه عقارب الساعة`}</p>
    <button type="button" className="companion-link" aria-pressed={active} onClick={() => void activate()}><Compass size={17} />{active ? "أوقف البوصلة الحية" : "شغّل البوصلة الحية"}</button>
    {message && <p className="tool-note" role="status">{message}</p>}
  </section>;
}
