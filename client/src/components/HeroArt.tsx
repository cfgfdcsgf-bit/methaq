import { useId } from "react";

/** Points of an n-pointed star centred on (cx, cy): alternating outer/inner radius. */
const star = (n: number, outer: number, inner: number, cx = 0, cy = 0, rotate = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const angle = ((rotate + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 === 0 ? outer : inner;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

const ARCH = (inset: number) =>
  `M${40 + inset} 548 V${262} C${40 + inset} ${152 + inset * 0.6} ${132 + inset * 0.3} ${92 + inset * 0.5} 220 ${18 + inset * 1.5} C${308 - inset * 0.3} ${92 + inset * 0.5} ${400 - inset} ${152 + inset * 0.6} ${400 - inset} 262 V548 Z`;

/**
 * The site's signature image: a mihrab (prayer niche) at night. A geometric rosette turns slowly
 * under a hanging lamp. Pure SVG: no images, no 3D library, scales to any width.
 */
export default function HeroArt() {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;
  return (
    <svg className="mihrab-art" viewBox="0 0 440 560" role="img" aria-label="محراب مضيء بنجمة هندسية وقنديل معلّق">
      <defs>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e7b8" /><stop offset=".5" stopColor="#cfa95c" /><stop offset="1" stopColor="#8d6b2f" />
        </linearGradient>
        <linearGradient id={id("night")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c4a3f" /><stop offset="1" stopColor="#041a16" />
        </linearGradient>
        <radialGradient id={id("glow")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity=".55" /><stop offset=".55" stopColor="#d9b266" stopOpacity=".16" /><stop offset="1" stopColor="#d9b266" stopOpacity="0" />
        </radialGradient>
        <pattern id={id("tile")} width="44" height="44" patternUnits="userSpaceOnUse">
          <polygon points={star(8, 20, 11, 22, 22)} fill="none" stroke="#d9b266" strokeOpacity=".32" strokeWidth=".8" />
          <circle cx="0" cy="0" r="2" fill="#d9b266" fillOpacity=".3" /><circle cx="44" cy="0" r="2" fill="#d9b266" fillOpacity=".3" />
          <circle cx="0" cy="44" r="2" fill="#d9b266" fillOpacity=".3" /><circle cx="44" cy="44" r="2" fill="#d9b266" fillOpacity=".3" />
        </pattern>
        <radialGradient id={id("fade")} cx=".5" cy=".52" r=".62">
          <stop offset=".35" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={id("wall")}><rect width="440" height="560" fill={`url(#${id("fade")})`} /></mask>
        <clipPath id={id("inside")}><path d={ARCH(22)} /></clipPath>
      </defs>

      {/* tiled wall around the niche */}
      <path d={`M0 0H440V560H0Z ${ARCH(0)}`} fillRule="evenodd" fill={`url(#${id("tile")})`} mask={`url(#${id("wall")})`} />

      {/* frame: three nested arches */}
      <path d={ARCH(0)} fill="none" stroke={`url(#${id("gold")})`} strokeWidth="3" />
      <path d={ARCH(10)} fill="none" stroke="#d9b266" strokeOpacity=".5" strokeWidth="1" />
      <path d={ARCH(22)} fill={`url(#${id("night")})`} stroke={`url(#${id("gold")})`} strokeWidth="2" />

      <g clipPath={`url(#${id("inside")})`}>
        {/* light behind the rosette */}
        <circle className="art-glow" cx="220" cy="318" r="190" fill={`url(#${id("glow")})`} />

        {/* rosette: three counter-turning layers */}
        <g transform="translate(220 318)">
          <g className="art-turn-a">
            <polygon points={star(16, 128, 104)} fill="#d9b266" fillOpacity=".07" stroke="#d9b266" strokeOpacity=".75" strokeWidth="1.2" />
            <polygon points={star(8, 112, 74)} fill="none" stroke="#e8d098" strokeOpacity=".55" strokeWidth="1" />
          </g>
          <g className="art-turn-b">
            <polygon points={star(8, 92, 58, 0, 0, -67.5)} fill="none" stroke="#e8d098" strokeOpacity=".8" strokeWidth="1.2" />
            <circle r="76" fill="none" stroke="#d9b266" strokeOpacity=".55" strokeWidth="1" strokeDasharray="2 5" />
          </g>
          <polygon points={star(8, 62, 40)} fill={`url(#${id("gold")})`} />
          <circle r="35" fill="#06241f" stroke="#f1deaa" strokeWidth="1.5" />
          <circle r="29" fill="none" stroke="#d9b266" strokeOpacity=".6" strokeWidth=".8" />
          <text className="art-name" y="11" textAnchor="middle" fontSize="31" fill="#f4e2b0">مِيثَاق</text>
        </g>

        {/* hanging lamp */}
        <g className="art-lamp">
          <line x1="220" y1="40" x2="220" y2="98" stroke="#d9b266" strokeWidth="1.4" strokeDasharray="3 3" />
          <circle cx="220" cy="136" r="42" fill={`url(#${id("glow")})`} />
          <path d="M203 112 Q220 90 237 112Z" fill={`url(#${id("gold")})`} />
          <path d="M203 112 L197 140 Q220 164 243 140 L237 112Z" fill="#f1d78f" fillOpacity=".85" stroke="#c9a45c" strokeWidth="1.2" />
          <path d="M220 158 L215.5 172 H224.5Z" fill={`url(#${id("gold")})`} />
        </g>

        {/* floor */}
        <rect x="40" y="498" width="360" height="62" fill="#031511" />
        <rect x="40" y="498" width="360" height="62" fill={`url(#${id("tile")})`} opacity=".7" />
        <line x1="40" y1="498" x2="400" y2="498" stroke={`url(#${id("gold")})`} strokeWidth="2" />
      </g>

      {/* light motes */}
      {[[96, 470, 0], [150, 440, 1.6], [296, 462, 3.1], [350, 430, 4.4], [214, 480, 2.2]].map(([x, y, d], i) => (
        <circle key={i} className="art-mote" cx={x} cy={y} r="2.2" fill="#f6e7b8" style={{ animationDelay: `${d}s` }} />
      ))}
    </svg>
  );
}