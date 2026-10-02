"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, X, Loader2, Compass, Database, Zap, FileText, Clock, Shield } from "lucide-react";
import { getUser, AuthUser, hasPermission } from "@/lib/auth";
import { fetchDbAuditConnectors, fetchDbAuditEvents } from "@/lib/api";

export default function NavbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<AuthUser | null>(getUser());

  useEffect(() => {
    const handleUserUpdate = (e: any) => setUserState(e.detail);
    window.addEventListener("sv_user_updated", handleUserUpdate);
    return () => window.removeEventListener("sv_user_updated", handleUserUpdate);
  }, []);

  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchData, setSearchData] = useState<{
    connectors: any[];
    events: any[];
  }>({ connectors: [], events: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const quickNavItems = [
    { type: "quick", id: "dash",   label: "Audit Overview",      href: "/dashboard",                              desc: "Change intelligence & metrics" },
    { type: "quick", id: "conns",  label: "Database Connectors", href: "/dashboard/connectors",                   desc: "Manage database data sources" },
    { type: "quick", id: "stream", label: "CDC Live Stream",     href: "/dashboard/connectors",                   desc: "Live WAL & mutation ledger" },
    { type: "quick", id: "ret",    label: "Data Retention",    href: "/settings/retention", desc: "Purge policies & history" },
    { type: "quick", id: "api",    label: "API Reference",     href: "/settings/engineering",        desc: "CDC endpoints & specs" },
  ];

  const searchablePages = [
    { label: "Audit Overview", href: "/dashboard", desc: "Real-time mutation metrics & connector status" },
    { label: "Database Connectors", href: "/dashboard/connectors", desc: "Manage PostgreSQL, MySQL, Redis, and Mongo data sources" },
    { label: "CDC Live Stream", href: "/dashboard/connectors", desc: "Live WAL & mutation event ledger" },
    { label: "Data Retention Settings", href: "/settings/retention", desc: "Manage database retention purge intervals for audit log ledgers" },
    { label: "API Credentials & Docs", href: "/settings/engineering", desc: "Access credentials, endpoints and documentation details" },
    { label: "Personal Profile", href: "/settings/profile", desc: "Update profile name, email, and password settings" },
    { label: "Theme & Appearance", href: "/settings/appearance", desc: "Light, dark, and system color mode settings" },
    { label: "Platform Updates", href: "/settings/updates", desc: "Software version releases, single-command upgrades, and changelog" },
    ...(hasPermission(user, "viewTeam") ? [
      { label: "Team Directory", href: "/settings/team", desc: "Workspace roles, Viewer, Member permissions" }
    ] : []),
    ...(hasPermission(user, "viewActivityLog") ? [
      { label: "Audit Logs & Activity History", href: "/settings/activity", desc: "View administrative activity log history" }
    ] : []),
  ];

  const loadSearchData = async () => {
    setSearchLoading(true);
    try {
      const [connRes, evtRes] = await Promise.all([
        fetchDbAuditConnectors().catch(() => ({ connectors: [] })),
        fetchDbAuditEvents().catch(() => ({ events: [] })),
      ]);
      setSearchData({
        connectors: connRes?.connectors || [],
        events: evtRes?.events || [],
      });
    } catch (err) {
      console.error("Failed to load search index", err);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (searchFocused) {
      loadSearchData();
    }
  }, [searchFocused]);

  useEffect(() => {
    setSearchFocused(false);
    setSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery, searchFocused]);

  useEffect(() => {
    if (activeIndex >= 0) {
      const activeEl = document.querySelector(".active-search-item");
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const query = searchQuery.trim().toLowerCase();

  const filteredPages = query
    ? searchablePages.filter((p) =>
        p.label.toLowerCase().includes(query) ||
        p.desc.toLowerCase().includes(query)
      )
    : [];

  const filteredConnectors = query
    ? searchData.connectors.filter((c: any) =>
        (c.name || "").toLowerCase().includes(query) ||
        (c.db_type || "").toLowerCase().includes(query) ||
        (c.database_name || "").toLowerCase().includes(query)
      ).slice(0, 4)
    : [];

  const filteredEvents = query
    ? searchData.events.filter((e: any) =>
        (e.table || "").toLowerCase().includes(query) ||
        (e.database || "").toLowerCase().includes(query) ||
        (e.operation || "").toLowerCase().includes(query)
      ).slice(0, 5)
    : [];

  const hasResults =
    filteredPages.length > 0 ||
    filteredConnectors.length > 0 ||
    filteredEvents.length > 0;

  const resultsList = !query
    ? quickNavItems
    : [
        ...filteredPages.map(p => ({ type: "page", id: p.href, label: p.label, href: p.href, desc: p.desc })),
        ...filteredConnectors.map(c => ({ type: "connector", id: c.id, label: c.name, href: "/dashboard/connectors", desc: `${c.db_type} • ${c.database_name || c.database || "connected"}` })),
        ...filteredEvents.map(e => ({ type: "event", id: e.id || e.event_id, label: `${e.operation} on ${e.table}`, href: "/dashboard/connectors", desc: `${e.database}.${e.table}` }))
      ];

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchFocused) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const len = resultsList.length;
        if (len === 0) return -1;
        return (prev + 1) % len;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const len = resultsList.length;
        if (len === 0) return -1;
        return prev <= 0 ? len - 1 : prev - 1;
      });
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < resultsList.length) {
        e.preventDefault();
        const activeItem = resultsList[activeIndex];
        setSearchFocused(false);
        router.push(activeItem.href);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setSearchQuery("");
        setSearchFocused(false);
        setActiveIndex(-1);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={searchRef} className="relative hidden md:block w-64 mr-2">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search database audit... (⌘K)"
          value={searchQuery}
          onFocus={() => setSearchFocused(true)}
          onClick={() => setSearchFocused(true)}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(true); }}
          onKeyDown={handleSearchKeyDown}
          className="w-full bg-gray-50/85 dark:bg-slate-800/40 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 rounded-xl pl-9 pr-8 py-1.5 border border-gray-100 dark:border-slate-800/60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
            className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search Dropdown Modal */}
      {searchFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#11141f] border border-gray-100 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-50 dark:border-slate-800/40 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 font-semibold px-3">
            <span>{query ? "Search Results" : "Quick Actions"}</span>
            {searchLoading && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
            {resultsList.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 dark:text-slate-500">
                No matching resources found
              </div>
            ) : (
              resultsList.map((item: any, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <Link
                    key={item.id || idx}
                    href={item.href}
                    onClick={() => setSearchFocused(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                        : "hover:bg-gray-50 dark:hover:bg-slate-800/50 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 shrink-0">
                      {item.type === "connector" ? <Database className="w-3.5 h-3.5 text-blue-500" /> :
                       item.type === "event" ? <Zap className="w-3.5 h-3.5 text-amber-500" /> :
                       <Compass className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{item.label}</div>
                      {item.desc && <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{item.desc}</div>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
