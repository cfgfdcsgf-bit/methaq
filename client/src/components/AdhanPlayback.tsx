import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { getCity } from "@/components/Tools";
import { readReminderPrefs } from "@/lib/reminders";
import { prayerTimes } from "@shared/prayer";

const startPreview = "meethaq-preview-adhan";
export const previewAdhan = () => window.dispatchEvent(new Event(startPreview));

export default function AdhanPlayback() {
  const audio = useRef<HTMLAudioElement>(null);
  const armed = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    const play = async (preview: boolean) => {
      try {
        player.currentTime = 0;
        await player.play();
        if (preview) armed.current = true;
        setNotice("");
      } catch {
        setNotice("تعذّر تشغيل الصوت تلقائيًا. يمكنك فتح مشغّل الأذان من المواقيت.");
      }
    };
    const tryPreview = () => { void play(true); };
    let previous = Date.now();
    let city = getCity();
    let minute: number | null = null;
    let due: ReturnType<typeof prayerTimes>["events"] = [];
    const updateCity = () => { city = getCity(); minute = null; };
    const clock = setInterval(() => {
      const now = Date.now();
      const from = previous;
      previous = now;
      if (!armed.current || document.hidden || now - from > 15_000) return;
      if (minute !== Math.floor(now / 60_000)) {
        minute = Math.floor(now / 60_000);
        due = prayerTimes(city, new Date(now)).events;
      }
      const event = due.find(prayer => prayer.at > from && prayer.at <= now);
      if (event && readReminderPrefs().prayers[event.prayer] === "adhan") void play(false);
    }, 1000);
    window.addEventListener(startPreview, tryPreview);
    window.addEventListener("meethaq-city-change", updateCity);
    return () => {
      clearInterval(clock);
      window.removeEventListener(startPreview, tryPreview);
      window.removeEventListener("meethaq-city-change", updateCity);
    };
  }, []);
  return <>
    <audio ref={audio} src="/adhan.mp3" preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    {(playing || notice) && <div className="adhan-toast" role="status">
      <Volume2 size={18} /><span>{playing ? "الأذان الآن" : notice}</span>
      <button type="button" className="detail-btn" onClick={() => { if (playing) audio.current?.pause(); else setNotice(""); }}>
        {playing ? <><Square size={13} /> إيقاف</> : "إغلاق"}
      </button>
    </div>}
  </>;
}
