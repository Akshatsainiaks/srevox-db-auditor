export function SrevoxLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 680 680" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        {/* Rich Cyan-to-Cobalt-to-Indigo Gradient */}
        <linearGradient id="dbAuditorG1" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#00d4ff"/>
          <stop offset="45%" stopColor="#2563eb"/>
          <stop offset="100%" stopColor="#312e81"/>
        </linearGradient>

        {/* Top Gloss Reflection */}
        <linearGradient id="dbAuditorG2" x1="0%" y1="0%" x2="0%" y2="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>

        {/* Shield Outer Glow Rim */}
        <linearGradient id="dbAuditorG3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      
      {/* ─── Outer Gloss Shield ─── */}
      <path d="M340,60 L540,175 L540,445 Q540,580 340,625 Q140,580 140,445 L140,175 Z"
        fill="url(#dbAuditorG1)" stroke="url(#dbAuditorG3)" strokeWidth="3.5"/>
      
      {/* Upper Glass Specular Dome */}
      <path d="M340,60 L540,175 L540,310 Q445,275 340,255 Q255,245 140,275 L140,175 Z"
        fill="url(#dbAuditorG2)" opacity="0.75"/>
      
      {/* Inner Shield Bevel Stroke */}
      <path d="M340,80 L522,188 L522,443 Q522,562 340,602 Q158,562 158,443 L158,188 Z"
        fill="none" stroke="white" strokeWidth="1.5" opacity="0.25"/>

      {/* ─── Database Cylinder Stack (Integrated Inside Shield) ─── */}
      {/* Bottom Layer Disc Curve */}
      <path
        d="M225,385 C225,415 455,415 455,385 V435 C455,465 225,465 225,435 Z"
        fill="white"
        fillOpacity="0.12"
        stroke="white"
        strokeWidth="6"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* Middle Layer Disc Curve */}
      <path
        d="M225,305 C225,335 455,335 455,305 V355 C455,385 225,385 225,355 Z"
        fill="white"
        fillOpacity="0.18"
        stroke="white"
        strokeWidth="6"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Top Database Disc Cylinder */}
      <path
        d="M225,225 C225,255 455,255 455,225 V275 C455,305 225,305 225,275 Z"
        fill="white"
        fillOpacity="0.25"
        stroke="white"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Top Disc Surface Ellipse */}
      <ellipse
        cx="340"
        cy="225"
        rx="115"
        ry="35"
        fill="white"
        fillOpacity="0.35"
        stroke="white"
        strokeWidth="6"
      />

      {/* ─── Central CDC Real-Time Audit Wave (High Contrast) ─── */}
      <polyline
        points="170,350 230,350 255,295 280,410 310,270 340,365 375,310 405,395 430,350 510,350"
        fill="none"
        stroke="white"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Real-time Audit Sensor Pulse Node */}
      <circle cx="310" cy="270" r="8" fill="#00d4ff" stroke="white" strokeWidth="2.5" />
      <circle cx="405" cy="395" r="7" fill="#67e8f9" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export function SrevoxWordmark({ size = "md", forceDark = false }: { size?: "sm" | "md" | "lg"; forceDark?: boolean }) {
  const dims = { sm: 26, md: 32, lg: 40 };
  const ts   = { sm: "text-sm", md: "text-base", lg: "text-xl" };
  const textColor = forceDark ? "text-white" : "text-gray-900 dark:text-white";

  return (
    <div className="flex items-center gap-2.5 select-none">
      <SrevoxLogo size={dims[size]} className="shrink-0" />
      <div className="flex items-center gap-2">
        <span className={`font-black tracking-tight ${ts[size]} ${textColor}`}>
          Srevox
        </span>
        <span className="text-gray-300 dark:text-slate-600 font-light text-sm select-none">
          |
        </span>
        <span className={`font-black tracking-tight uppercase ${ts[size]} ${textColor}`}>
          DB AUDITOR
        </span>
      </div>
    </div>
  );
}

export default SrevoxLogo;
