const fs = require('fs');

const svg = `<svg width="680" height="680" viewBox="0 0 680 680" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0d1b3e"/>
      <stop offset="100%" stop-color="#050810"/>
    </radialGradient>
    <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00aaff"/>
      <stop offset="50%" stop-color="#3b5bff"/>
      <stop offset="100%" stop-color="#7b2fff"/>
    </linearGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00ccff"/>
      <stop offset="100%" stop-color="#8833ff"/>
    </linearGradient>
    <linearGradient id="layerGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a6fff"/>
      <stop offset="100%" stop-color="#5533ff"/>
    </linearGradient>
    <linearGradient id="layerGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1455dd"/>
      <stop offset="100%" stop-color="#4422cc"/>
    </linearGradient>
    <linearGradient id="layerGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e3fbb"/>
      <stop offset="100%" stop-color="#3311aa"/>
    </linearGradient>
  </defs>
  <circle cx="340" cy="340" r="330" fill="url(#bgGrad)"/>
  <circle cx="340" cy="340" r="268" fill="none" stroke="url(#ringGrad)" stroke-width="3.5"/>
  <circle cx="340" cy="72" r="14" fill="#00ccff"/>
  <circle cx="608" cy="340" r="14" fill="#8833ff"/>
  <circle cx="340" cy="608" r="14" fill="#6622ee"/>
  <polygon points="340,148 488,233 488,447 340,532 192,447 192,233" fill="none" stroke="url(#hexGrad)" stroke-width="4"/>
  <polygon points="340,178 468,248 468,428 340,498 212,428 212,248" fill="url(#hexGrad)" opacity="0.15"/>
  <polygon points="340,178 468,248 468,428 340,498 212,428 212,248" fill="none" stroke="url(#hexGrad)" stroke-width="2.5"/>
  <path d="M230,400 L340,460 L450,400 L450,420 L340,480 L230,420 Z" fill="url(#layerGrad3)" opacity="0.9"/>
  <path d="M230,365 L340,425 L450,365 L450,385 L340,445 L230,385 Z" fill="url(#layerGrad2)" opacity="0.9"/>
  <path d="M230,330 L340,390 L450,330 L450,350 L340,410 L230,350 Z" fill="url(#layerGrad1)" opacity="0.95"/>
  <polygon points="340,270 450,330 340,390 230,330" fill="url(#hexGrad)" opacity="0.85"/>
  <polyline points="258,330 288,330 300,305 312,358 325,315 338,330 382,330 394,310 406,350 418,330 442,330" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
</svg>`;

const encoded = encodeURIComponent(svg.replace(/\n\s*/g, ''));
console.log(encoded);
