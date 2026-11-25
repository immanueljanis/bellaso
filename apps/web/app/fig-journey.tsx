/** Fig. 2 of the landing page: the path of one link payment, as the design canvas draws it. */
export function FigJourney() {
  return (
    <svg
      viewBox="0 0 520 380"
      role="img"
      aria-label="Rina publishes a key. The payer reads it, then sends funds to a new one-time account and writes an announcement. Rina's inbox opens the announcement. There is no public link from the one-time account to Rina."
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
    >
      <g strokeLinecap="round">
        <rect
          x="380"
          y="26"
          width="120"
          height="64"
          fill="oklch(0.145 0.004 60)"
          stroke="oklch(0.96 0.004 90)"
          strokeOpacity="0.6"
          strokeWidth="1.2"
        ></rect>
        <rect
          className="ph1"
          x="380"
          y="26"
          width="120"
          height="64"
          fill="oklch(0.25 0.05 50)"
          stroke="oklch(0.74 0.17 50)"
          strokeWidth="1.6"
          opacity="0"
        ></rect>
        <text x="440" y="54" textAnchor="middle" data-font="sans" fontSize="14" fontWeight="600" fill="oklch(0.96 0.004 90)">
          Rina
        </text>
        <text x="440" y="74" textAnchor="middle" data-font="mono" fontSize="11" fill="oklch(0.74 0.17 50)">
          ek_A · 1,568 B
        </text>
        <path
          className="ph2"
          d="M378,62 C260,58 120,76 82,156"
          fill="none"
          stroke="oklch(0.74 0.17 50)"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        ></path>
        <text className="ph2" x="196" y="78" data-font="sans" fontSize="12" fill="oklch(0.74 0.17 50)">
          reads Rina's key
        </text>
        <rect
          x="20"
          y="160"
          width="120"
          height="56"
          fill="oklch(0.145 0.004 60)"
          stroke="oklch(0.96 0.004 90)"
          strokeOpacity="0.6"
          strokeWidth="1.2"
        ></rect>
        <text x="80" y="193" textAnchor="middle" data-font="sans" fontSize="14" fill="oklch(0.96 0.004 90)">
          Payer
        </text>
        <rect x="250" y="160" width="150" height="56" fill="oklch(0.145 0.004 60)" stroke="oklch(0.74 0.17 50)" strokeWidth="1.2"></rect>
        <rect
          className="hit"
          x="250"
          y="160"
          width="150"
          height="56"
          fill="oklch(0.25 0.05 50)"
          stroke="oklch(0.74 0.17 50)"
          strokeWidth="1.6"
          opacity="0"
        ></rect>
        <text x="325" y="184" textAnchor="middle" data-font="sans" fontSize="13" fill="oklch(0.96 0.004 90)">
          One-time account
        </text>
        <text x="325" y="204" textAnchor="middle" data-font="mono" fontSize="12" fill="oklch(0.74 0.17 50)">
          qor1 7f3k…x9q2
        </text>
        <line x1="140" y1="188" x2="246" y2="188" stroke="oklch(0.74 0.17 50)" strokeWidth="1.6"></line>
        <text x="193" y="178" textAnchor="middle" data-font="sans" fontSize="12" fill="oklch(0.74 0.17 50)">
          150 fUSD
        </text>
        <circle className="pa" cx="142" cy="188" r="4.5" fill="oklch(0.74 0.17 50)" opacity="0"></circle>
        <rect x="250" y="290" width="150" height="56" fill="oklch(0.145 0.004 60)" stroke="oklch(0.82 0.01 80)" strokeWidth="1.2"></rect>
        <text x="325" y="314" textAnchor="middle" data-font="sans" fontSize="13" fill="oklch(0.96 0.004 90)">
          Announcement
        </text>
        <text x="325" y="333" textAnchor="middle" data-font="mono" fontSize="12" fill="oklch(0.82 0.01 80)">
          1,570 bytes
        </text>
        <path d="M80,216 L80,318 L246,318" fill="none" stroke="oklch(0.82 0.01 80)" strokeWidth="1.6"></path>
        <rect className="pb" x="76" y="214" width="8" height="7" fill="oklch(0.82 0.01 80)" opacity="0"></rect>
        <line className="beam" x1="252" y1="282" x2="252" y2="354" stroke="oklch(0.74 0.17 50)" strokeWidth="1.6" opacity="0"></line>
        <line x1="352" y1="156" x2="380" y2="124" stroke="oklch(0.74 0.006 90)" strokeWidth="1.1" strokeDasharray="3 5"></line>
        <line x1="404" y1="108" x2="424" y2="94" stroke="oklch(0.74 0.006 90)" strokeWidth="1.1" strokeDasharray="3 5"></line>
        <g className="cut">
          <line x1="376" y1="106" x2="396" y2="126" stroke="oklch(0.82 0.01 80)" strokeWidth="1.8"></line>
          <line x1="386" y1="100" x2="406" y2="120" stroke="oklch(0.82 0.01 80)" strokeWidth="1.8"></line>
        </g>
        <text className="cut" x="414" y="134" data-font="sans" fontSize="12" fill="oklch(0.82 0.01 80)">
          no public link
        </text>
        <g className="hit" opacity="0">
          <circle cx="490" cy="34" r="11" fill="oklch(0.74 0.17 50)"></circle>
          <path d="M484.5,34.5 L488.5,38.5 L495.5,30.5" fill="none" stroke="oklch(0.15 0.005 60)" strokeWidth="2"></path>
        </g>
      </g>
    </svg>
  );
}
