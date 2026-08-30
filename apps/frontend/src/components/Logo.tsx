export function SrevoxLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 680 680" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="g1" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#00cfff"/>
          <stop offset="40%" stopColor="#1a7fff"/>
          <stop offset="100%" stopColor="#0033cc"/>
        </linearGradient>
        <linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60e0ff" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#0044ff" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
      
      <path d="M340,60 L540,175 L540,445 Q540,580 340,625 Q140,580 140,445 L140,175 Z"
        fill="url(#g1)" stroke="url(#g3)" strokeWidth="3"/>
      <path d="M340,60 L540,175 L540,310 Q445,275 340,255 Q255,245 140,275 L140,175 Z"
        fill="url(#g2)" opacity="0.7"/>
      <path d="M340,80 L522,188 L522,443 Q522,562 340,602 Q158,562 158,443 L158,188 Z"
        fill="none" stroke="white" strokeWidth="1.5" opacity="0.25"/>
      <polyline
        points="175,345 235,345 255,298 278,398 304,282 328,345 395,345 418,302 442,385 464,345 510,345"
        fill="none" stroke="white" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function SrevoxWordmark({ size = "md", forceDark = false }: { size?: "sm" | "md" | "lg"; forceDark?: boolean }) {
  const dims = { sm: 28, md: 34, lg: 42 };
  const ts   = { sm: "text-sm", md: "text-base", lg: "text-xl" };
  const textColor = forceDark ? "text-white" : "text-gray-900 dark:text-white";
  return (
    <div className="flex items-center gap-2.5">
      <SrevoxLogo size={dims[size]} />
      <div className={`font-bold leading-tight ${ts[size]} ${textColor}`}>Srevox</div>
    </div>
  );
}
