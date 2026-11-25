import { siteImages, type SiteImageName } from "../lib/site-images";
import { Icon } from "./icons";

const formats = [["image/avif", "avif"], ["image/webp", "webp"]] as const;

/** Responsive licensed photograph: AVIF and WebP with a JPEG fallback. */
export function Photo({ name, alt, sizes = "100vw", priority = false, className }: { name: SiteImageName; alt: string; sizes?: string; priority?: boolean; className?: string }) {
  const image = siteImages[name];
  const widths: readonly number[] = image.widths;
  const largest = widths[widths.length - 1];
  const fallback = widths.includes(1280) ? 1280 : largest;
  const set = (extension: string) => widths.map(width => `/images/${name}-${width}.${extension} ${width}w`).join(", ");
  return <picture className={"site-photo" + (className ? " " + className : "")}>
    {formats.map(([type, extension]) => <source key={type} type={type} srcSet={set(extension)} sizes={sizes} />)}
    <img src={`/images/${name}-${fallback}.jpg`} srcSet={set("jpg")} sizes={sizes} width={largest} height={Math.round(image.height * largest / image.width)} alt={alt} loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"} fetchPriority={priority ? "high" : undefined} />
  </picture>;
}

// Johannesburg's northern suburbs, simplified. North is up; the drawing spans x 0–2000 and is framed
// so the action (Melrose to Sandton along the M1) stays in view on narrow screens.
const roads = {
  n1: "M40 960 C150 760 250 600 380 450 C470 350 640 300 820 318 C960 332 1080 380 1150 330 C1210 286 1205 170 1240 40 L1262 -20",
  m1: "M1015 1030 C1006 930 1020 820 1028 740 C1036 660 1060 560 1090 470 C1110 410 1130 370 1150 330",
  williamNicol: "M712 900 C690 780 640 640 600 520 C560 400 500 260 448 110",
  rivonia: "M905 650 C900 560 892 470 884 380 C876 290 866 180 858 60",
  janSmuts: "M770 1030 C760 990 745 940 728 880 C722 860 716 838 712 820",
  malibongwe: "M330 650 C300 540 268 420 222 300 C180 190 130 90 88 -20",
  extra1: "M1150 330 C1300 300 1500 320 1720 280 C1830 260 1920 250 2010 240",
  extra2: "M1028 740 C1200 720 1420 760 1640 700 C1780 660 1900 640 2010 620",
  extra3: "M380 450 C300 470 200 520 -20 560",
};
const minor = [
  "M520 980 C620 900 760 870 900 860", "M600 640 C700 610 820 600 905 600", "M470 300 C560 270 700 250 860 240",
  "M1300 980 C1290 860 1300 700 1320 560", "M1480 1020 C1470 860 1500 640 1540 480", "M1180 600 C1300 580 1420 590 1560 560",
  "M250 820 C330 760 420 740 560 730", "M150 380 C260 360 360 330 470 300", "M960 140 C1060 150 1160 160 1236 150",
  "M1700 980 C1690 820 1700 660 1740 520", "M1380 200 C1480 220 1600 230 1760 200", "M640 180 C720 200 790 210 862 200",
];
const officers: [number, number][] = [[1062, 772], [720, 600], [520, 380], [880, 200], [1250, 520], [1180, 230], [420, 700], [1420, 380], [640, 860], [1560, 640], [300, 300], [980, 420]];
const suburbs: [string, number, number][] = [["Midrand", 1270, 120], ["Fourways", 470, 160], ["Bryanston", 640, 430], ["Sandton", 960, 560], ["Randburg", 330, 590], ["Rosebank", 800, 900], ["Melrose", 1090, 830]];

export function DispatchMap({ id = "map", animated = true }: { id?: string; animated?: boolean }) {
  const route = "M1062 772 C1040 740 1030 712 1032 680 C1036 640 1048 600 1060 566 C1040 548 1010 538 984 528";
  return <svg viewBox="-60 0 1600 1000" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby={id + "-title"} data-animated={animated ? "" : undefined}>
    <title id={id + "-title"}>Map of Johannesburg’s northern suburbs with verified officers on duty and an officer confirmed for a site in Sandton</title>
    <rect className="map-land" x="-200" y="-20" width="2400" height="1040" />
    <path className="map-block" d="M560 470 C640 450 760 470 820 520 C860 560 840 640 780 660 C700 690 600 660 570 600 C545 550 530 500 560 470Z" />
    <path className="map-block" d="M900 470 C960 440 1060 450 1090 500 C1110 540 1080 600 1020 610 C960 620 900 590 890 540 C885 510 885 485 900 470Z" />
    <path className="map-block" d="M1180 60 C1260 40 1360 60 1380 120 C1400 180 1330 220 1260 210 C1200 200 1160 160 1160 110 C1160 90 1165 70 1180 60Z" />
    {minor.map(d => <path key={d} className="map-minor" d={d} />)}
    <g>
      <path id={id + "-malibongwe"} className="map-road" d={roads.malibongwe} />
      <path id={id + "-wn"} className="map-road" d={roads.williamNicol} />
      <path id={id + "-rivonia"} className="map-road" d={roads.rivonia} />
      <path id={id + "-jansmuts"} className="map-road" d={roads.janSmuts} />
      <path className="map-road" d={roads.extra1} /><path className="map-road" d={roads.extra2} /><path className="map-road" d={roads.extra3} />
      <path className="map-road map-road--major" d={roads.n1} />
      <path className="map-road map-road--major" d={roads.m1} />
    </g>
    <g aria-hidden="true">
      <text className="map-road-name" dy="-9"><textPath href={"#" + id + "-malibongwe"} startOffset="28%">Malibongwe Drive</textPath></text>
      <text className="map-road-name" dy="-9"><textPath href={"#" + id + "-wn"} startOffset="12%">William Nicol Drive</textPath></text>
      <text className="map-road-name" dy="-9"><textPath href={"#" + id + "-rivonia"} startOffset="30%">Rivonia Road</textPath></text>
      <text className="map-road-name" dy="16"><textPath href={"#" + id + "-jansmuts"} startOffset="2%">Jan Smuts Avenue</textPath></text>
      <g className="map-shield" transform="translate(1022 900)"><rect x="-20" y="-13" width="40" height="26" rx="6" /><text>M1</text></g>
      <g className="map-shield" transform="translate(300 560)"><rect x="-20" y="-13" width="40" height="26" rx="6" /><text>N1</text></g>
      <g className="map-shield" transform="translate(1214 150)"><rect x="-20" y="-13" width="40" height="26" rx="6" /><text>N1</text></g>
      {suburbs.map(([name, x, y]) => <text key={name} className="map-suburb" x={x} y={y}>{name}</text>)}
    </g>
    <g aria-hidden="true">
      {officers.map(([x, y]) => <g key={x + "-" + y} className="map-officer"><circle cx={x} cy={y} r="13" /><circle cx={x} cy={y} r="6.5" /></g>)}
      <path className="map-route" d={route} pathLength={1} />
      <circle className="map-site-ring" cx="984" cy="528" r="16" />
      <circle className="map-site" cx="984" cy="528" r="11" />
      <circle cx="984" cy="528" r="4" fill="#fff" />
      <g transform="translate(1004 446)"><g className="map-confirm">
        <rect width="272" height="64" rx="10" />
        <circle cx="24" cy="32" r="9" />
        <path d="M19.5 32 l3 3 l6 -6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="44" y="27">Officer confirmed</text>
        <text className="map-confirm-detail" x="44" y="47">PSIRA verified, Passport current</text>
      </g></g>
    </g>
  </svg>;
}

export function PassportCredential({ grade = "Grade B" }: { grade?: string }) {
  const validUntil = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(new Date().getFullYear() + 1, 1, 1));
  return <div className="passport-stage" role="img" aria-label={`A LOKD Passport credential showing the officer’s name, PSIRA ${grade}, a QR code and a blue verified status`}>
    <div className="passport-card" aria-hidden="true">
      <div className="passport-shadow" />
      <div className="passport-back" />
      <div className="passport-face">
        <div className="passport-top">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
          <img src="/brand/lokd-mark.svg" width={40} height={40} alt="" />
          <span>LOKD Passport</span>
        </div>
        <div className="passport-id"><small>Officer</small><strong>S. Nkosi</strong><small>PSIRA {grade}</small></div>
        <div className="passport-qr">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG QR */}
          <img src="/lokd-passport-qr.svg" width={256} height={256} alt="" />
        </div>
        <div className="passport-foot"><span className="passport-verified"><Icon name="circleCheck" size={18} />Verified</span><span>Valid until {validUntil}</span></div>
      </div>
    </div>
  </div>;
}

export const gradeRungs: [string, string][] = [["E", "Entry level"], ["D", "Entry level"], ["C", "Grade upgrade"], ["B", "Grade upgrade"], ["A", "Grade upgrade"]];

export function GradeLadder({ light = false }: { light?: boolean }) {
  return <div className={"ladder" + (light ? " ladder--light" : "")}>
    <div>
      <ol className="ladder-rungs" aria-label="PSIRA grades from E up to A">{gradeRungs.map(([grade, stage]) => <li key={grade}><b>{grade}</b><span><span className="sr-only">Grade {grade}, </span>{stage}</span></li>)}</ol>
    </div>
    <ul className="ladder-branches" aria-label="Specialist training">
      <li><strong>Firearms competency</strong><span>Safe handling, law and practical proficiency.</span><br /><span className="saps">SAPS-certified</span></li>
      <li><strong>Armed readiness</strong><span>For registered officers moving into armed work.</span></li>
      <li><strong>VIP / close protection</strong><span>Protective planning, movement and response.</span></li>
    </ul>
    <p className="ladder-group">Entry-level training: Grades E and D. Grade upgrades: C, B and A.</p>
  </div>;
}
