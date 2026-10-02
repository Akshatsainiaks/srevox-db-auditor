import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmModal";

export const metadata: Metadata = {
  title: "Srevox DB Auditor — Database Change Intelligence & CDC Audit",
  description: "Real-time CDC database mutation streaming, column diff inspection, and in-memory PII masking across production databases.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline SVG favicon — works without public folder */}
        <link rel="icon" href="/favicon.svg?v=5" type="image/svg+xml" />
        {/* Anti-flash script — runs before paint, applies dark class instantly */}
        <script dangerouslySetInnerHTML={{ __html: `
(function() {
  try {
    var path = window.location.pathname;
    var isDocs = path.startsWith('/docs');
    var key = isDocs ? 'sv_docs_theme' : 'sv_dashboard_theme';
    var cookieMatch = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    var t = (cookieMatch ? cookieMatch[2] : null) || localStorage.getItem(key) || localStorage.getItem('sv_dashboard_theme');
    var isDark = (path !== '/' && path !== '/login') && (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
    var r = document.documentElement;
    if (isDark) {
      r.classList.add('dark');
      r.style.backgroundColor = '#0d0f17';
      r.style.setProperty('--docs-bg',        '#0d0f17');
      r.style.setProperty('--docs-side-bg',   '#101218');
      r.style.setProperty('--docs-nav-bg',    '#101218');
      r.style.setProperty('--docs-nav-bdr',   '#1e293b');
      r.style.setProperty('--docs-txt',       '#f1f5f9');
      r.style.setProperty('--docs-muted',     '#64748b');
      r.style.setProperty('--docs-bdr',       '#1e293b');
      r.style.setProperty('--docs-input-bg',  '#1e293b');
      r.style.setProperty('--docs-input-txt', '#cbd5e1');
    } else {
      r.classList.remove('dark');
      r.style.backgroundColor = path === '/' ? '#ffffff' : '#f8fafc';
      r.style.setProperty('--docs-bg',        '#ffffff');
      r.style.setProperty('--docs-side-bg',   '#f9fafb');
      r.style.setProperty('--docs-nav-bg',    '#ffffff');
      r.style.setProperty('--docs-nav-bdr',   '#e5e7eb');
      r.style.setProperty('--docs-txt',       '#111827');
      r.style.setProperty('--docs-muted',     '#9ca3af');
      r.style.setProperty('--docs-bdr',       '#e5e7eb');
      r.style.setProperty('--docs-input-bg',  '#ffffff');
      r.style.setProperty('--docs-input-txt', '#374151');
    }
  } catch(e) {}
})();
        `}} />
      </head>
      <body className="antialiased bg-slate-50 dark:bg-[#0d0f17] text-gray-900 dark:text-slate-100">
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}