"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, X, Loader2, Compass, Server, BookOpen, Bell, AlertTriangle } from "lucide-react";
import { getUser, AuthUser, hasPermission } from "@/lib/auth";
import { fetchIncidents, fetchClusters, fetchRules, fetchChannels } from "@/lib/api";

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
    incidents: any[];
    clusters: any[];
    rules: any[];
    channels: any[];
  }>({ incidents: [], clusters: [], rules: [], channels: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const quickNavItems = [
    { type: "quick", id: "dash", label: "Dashboard", href: "/dashboard", desc: "Overview & metrics" },
    { type: "quick", id: "inc", label: "Incidents", href: "/dashboard/incidents", desc: "Active crash logs" },
    { type: "quick", id: "clus", label: "Clusters", href: "/dashboard/clusters", desc: "K8s connections" },
    { type: "quick", id: "rule", label: "Alert Rules", href: "/dashboard/rules", desc: "Thresholds & triggers" },
  ];

  const searchablePages = [
    { label: "Dashboard", href: "/dashboard", desc: "Overview & metrics" },
    { label: "Incidents Feed", href: "/dashboard/incidents", desc: "Active container failures & restarts" },
    ...(hasPermission(user, "viewMachines") ? [
      { label: "Machines & Host Nodes", href: "/dashboard/machines", desc: "Linux host node telemetry and agent status" }
    ] : []),
    { label: "Alert Routing Channels", href: "/settings/channels", desc: "Teams, Email, Slack/Webhook integration" },
    { label: "Alert Rules & Conditions", href: "/dashboard/rules", desc: "Threshold configurations & filters" },
    { label: "Service Owners Routing", href: "/dashboard/services", desc: "Team alerts ownership routing" },
    { label: "Service Features Settings", href: "/dashboard/services/features", desc: "Global routing defaults, fallback channels, and muting" },
    { label: "System Analytics & Metrics", href: "/dashboard/analytics", desc: "System analytics, crash rates, and resolution metrics" },
    { label: "Pod Crash Analytics", href: "/dashboard/analytics/pods", desc: "Analysis of pod crash logs, restart frequencies, and logs" },
    { label: "Alert Analytics & Logs", href: "/dashboard/analytics/alerts", desc: "Muting duration statistics and channel dispatch frequencies" },
    ...(hasPermission(user, "viewTeam") ? [
      { label: "Team Directory", href: "/settings/team", desc: "Workspace roles, Viewer, Member permissions" }
    ] : []),
    ...(hasPermission(user, "viewActivityLog") ? [
      { label: "Audit Logs & Activity History", href: "/settings/activity", desc: "View administrative activity log history" }
    ] : []),
    ...(hasPermission(user, "changeRole") ? [
      { label: "User Permissions Override", href: "/settings/permissions", desc: "Granular administrative overrides" },
      { label: "User Groups Management", href: "/settings/groups", desc: "Team grouping & policy inheritance" }
    ] : []),
    ...(hasPermission(user, "changeRetention") ? [
      { label: "Audit Logs Retention settings", href: "/settings/more-settings?tab=logs", desc: "Manage database retention purge intervals for audit log ledgers" },
      { label: "Incident Auto-Purge settings", href: "/settings/more-settings?tab=incidents", desc: "Manage auto-purge settings for incident logs" },
    ] : []),
    ...(user?.role === "admin" ? [
      { label: "Organization Settings", href: "/settings/org", desc: "Workspace identity & branding details" },
      { label: "Sudo Security Lock passcode", href: "/settings/org#sudo-security-lock", desc: "Update organization-wide sudo lock passcode" },
      { label: "Audit Logs Retention settings", href: "/settings/more-settings?tab=logs", desc: "Manage database retention purge intervals for audit log ledgers" },
      { label: "Incident Auto-Purge settings", href: "/settings/more-settings?tab=incidents", desc: "Manage auto-purge settings for incident logs" },
      { label: "Platform Update settings", href: "/settings/more-settings?tab=update", desc: "Manage platform updates check intervals" },
      { label: "API Credentials & Docs", href: "/settings/more-settings?tab=api-docs", desc: "Access credentials, endpoints and documentation details" },
      { label: "More Administrative Settings", href: "/settings/more-settings", desc: "Configure administrative preferences, data retention settings, and platform telemetry" }
    ] : []),
    { label: "Personal Profile", href: "/settings/profile", desc: "Update profile name, email, and password settings" },
    { label: "Alert Preferences", href: "/settings/preferences", desc: "Personal warning severities filters" },
    { label: "Theme & Appearance", href: "/settings/appearance", desc: "Light, dark, and system color mode settings" },
    { label: "Personal Alert Channels", href: "/settings/alerts", desc: "Configure personal notifications settings" },
    { label: "AI Assistant Configuration", href: "/settings/ai", desc: "Enable or disable AI diagnostics models" },
    { label: "Demo Sandbox Tours", href: "/settings/demo", desc: "Interactive guided system sandbox walkthroughs" },
    { label: "Engineering Console Parameters", href: "/settings/engineering", desc: "Advanced systems metrics diagnostics configuration" },
    { label: "Share Feedback with Developers", href: "/settings/feedback", desc: "Send feedback & bugs reports to Srevox Support" },
    // { label: "Infrastructure Telemetry", href: "/dashboard/infrastructure", desc: "Live node/pod resources & limits" },
    { label: "Documentation Setup Guides", href: "/docs", desc: "Setup guides, API integration tutorials" },
    { label: "Troubleshooter Diagnostics", href: "/dashboard/troubleshooter", desc: "Log diagnostics & error resolver" },
  ];

  const resultsList = !searchQuery.trim()
    ? quickNavItems
    : [
        ...(searchQuery
          ? searchablePages.filter((p) =>
              p.label.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              p.desc.toLowerCase().includes(searchQuery.trim().toLowerCase())
            )
          : []
        ).map(page => ({
          type: "page",
          id: page.href,
          href: page.href,
          title: page.label,
        })),
        ...(searchQuery
          ? searchData.incidents.filter((i: any) =>
              (i.pod_name || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              (i.namespace || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              (i.crash_reason || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              (i.cluster_name && i.cluster_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
            ).slice(0, 5)
          : []
        ).map(inc => ({
          type: "incident",
          id: inc.incident_id,
          href: `/dashboard/incidents/${inc.incident_id}`,
          title: inc.pod_name,
        })),
        ...(searchQuery
          ? searchData.clusters.filter((c: any) =>
              (c.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
            ).slice(0, 3)
          : []
        ).flatMap(cl => [
          {
            type: "cluster",
            id: `cluster-${cl.cluster_id}`,
            href: `/cluster/${cl.cluster_id}`,
            title: `${cl.name} (Summary)`,
          },
          {
            type: "cluster",
            id: `cluster-infra-${cl.cluster_id}`,
            href: `/cluster/${cl.cluster_id}/infrastructure`,
            title: `${cl.name} (Infrastructure Metrics)`,
          },
          {
            type: "cluster",
            id: `cluster-alerts-${cl.cluster_id}`,
            href: `/cluster/${cl.cluster_id}/alerts`,
            title: `${cl.name} (Alerts)`,
          }
        ]),
        ...(searchQuery
          ? searchData.rules.filter((r: any) =>
              (r.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              (r.description && r.description.toLowerCase().includes(searchQuery.trim().toLowerCase()))
            ).slice(0, 3)
          : []
        ).map(ru => ({
          type: "rule",
          id: ru.rule_id,
          href: "/dashboard/rules",
          title: ru.name,
        })),
        ...(searchQuery
          ? searchData.channels.filter((c: any) =>
              (c.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              (c.type || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
            ).slice(0, 3)
          : []
        ).map(ch => ({
          type: "channel",
          id: ch.channel_id,
          href: "/settings/channels",
          title: ch.name,
        }))
      ];

  const loadSearchData = async () => {
    setSearchLoading(true);
    try {
      const [incRes, clRes, ruRes, chRes] = await Promise.all([
        fetchIncidents().catch(() => ({ incidents: [] })),
        fetchClusters().catch(() => ({ clusters: [] })),
        fetchRules().catch(() => ({ rules: [] })),
        fetchChannels().catch(() => ({ channels: [] })),
      ]);
      setSearchData({
        incidents: incRes?.incidents || [],
        clusters: clRes?.clusters || [],
        rules: ruRes?.rules || [],
        channels: chRes?.channels || [],
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
    setSearchFocused(document.activeElement === searchInputRef.current);
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

  const query = searchQuery.trim().toLowerCase();

  const filteredPages = query
    ? searchablePages.filter((p) =>
        p.label.toLowerCase().includes(query) ||
        p.desc.toLowerCase().includes(query)
      )
    : [];

  const filteredIncidents = query
    ? searchData.incidents.filter((i: any) =>
        (i.pod_name || "").toLowerCase().includes(query) ||
        (i.namespace || "").toLowerCase().includes(query) ||
        (i.crash_reason || "").toLowerCase().includes(query) ||
        (i.cluster_name && i.cluster_name.toLowerCase().includes(query))
      ).slice(0, 5)
    : [];

  const filteredClusters = query
    ? searchData.clusters.filter((c: any) =>
        (c.name || "").toLowerCase().includes(query)
      ).slice(0, 3)
    : [];

  const filteredRules = query
    ? searchData.rules.filter((r: any) =>
        (r.name || "").toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query))
      ).slice(0, 3)
    : [];

  const filteredChannels = query
    ? searchData.channels.filter((c: any) =>
        (c.name || "").toLowerCase().includes(query) ||
        (c.type || "").toLowerCase().includes(query)
      ).slice(0, 3)
    : [];

  const hasResults =
    filteredPages.length > 0 ||
    filteredIncidents.length > 0 ||
    filteredClusters.length > 0 ||
    filteredRules.length > 0 ||
    filteredChannels.length > 0;

  return (
    <div ref={searchRef} className="relative hidden md:block w-64 mr-2">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search everything... (⌘K)"
          value={searchQuery}
          onFocus={() => setSearchFocused(true)}
          onClick={() => setSearchFocused(true)}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(true); }}
          onKeyDown={handleSearchKeyDown}
          className="w-full bg-gray-50/85 dark:bg-slate-800/40 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 rounded-xl pl-9 pr-8 py-1.5 border border-gray-100 dark:border-slate-800/60 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-550/30 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSearchFocused(false);
              setActiveIndex(-1);
              searchInputRef.current?.blur();
            }}
            className="absolute right-2.5 p-1 rounded-lg hover:bg-gray-150 dark:hover:bg-slate-800/60 text-gray-400 hover:text-gray-650 dark:hover:text-slate-200 transition-colors"
            title="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {searchFocused && (
        <div className="absolute right-0 top-full mt-2 w-[440px] bg-white dark:bg-[#1e2130] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
          {searchLoading && (
            <div className="p-6 text-center text-xs text-gray-400 dark:text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Indexing Srevox resources...
            </div>
          )}

          {!searchLoading && !query && (
            <div className="p-3">
              <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1.5 text-left">
                Quick navigation
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-left">
                {quickNavItems.map((item, idx) => {
                  const isActive = activeIndex === idx;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSearchFocused(false)}
                      className={`flex flex-col p-2.5 rounded-xl transition-colors border ${
                        isActive
                          ? "active-search-item bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-150/50 dark:border-indigo-500/20"
                          : "bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/40 border-transparent hover:border-gray-100 dark:hover:border-slate-800"
                      }`}
                    >
                      <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">{item.label}</span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 leading-tight">{item.desc}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!searchLoading && query && hasResults && (
            <div className="divide-y divide-gray-50 dark:divide-slate-800/40 text-left font-sans">
              {/* Pages */}
              {filteredPages.length > 0 && (
                <div className="p-2">
                  <div className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                    Pages
                  </div>
                  {filteredPages.map((page: any, i) => {
                    const globalIdx = i;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <Link
                        key={page.href}
                        href={page.href}
                        onClick={() => { setSearchFocused(false); }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors ${
                          isActive ? "active-search-item bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{page.label}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            {page.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Incidents */}
              {filteredIncidents.length > 0 && (
                <div className="p-2">
                  <div className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                    Incidents
                  </div>
                  {filteredIncidents.map((inc: any, i) => {
                    const globalIdx = filteredPages.length + i;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <Link
                        key={inc.incident_id}
                        href={`/dashboard/incidents/${inc.incident_id}`}
                        onClick={() => { setSearchFocused(false); }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors ${
                          isActive ? "active-search-item bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${inc.severity === "critical" ? "bg-red-500 animate-pulse" : inc.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{inc.pod_name}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            {inc.namespace} {inc.cluster_name ? `· ${inc.cluster_name}` : ""}
                          </div>
                        </div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border capitalize shrink-0 ${
                          inc.status === "open" ? "bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20" :
                          inc.status === "acknowledged" ? "bg-amber-50/50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20" :
                          "bg-green-50/50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-100 dark:border-green-500/20"
                        }`}>{inc.status}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Clusters */}
              {filteredClusters.length > 0 && (
                <div className="p-2">
                  <div className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                    Clusters
                  </div>
                  {filteredClusters.map((cl: any, i) => {
                    const globalIdx = filteredPages.length + filteredIncidents.length + i;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <Link
                        key={cl.cluster_id}
                        href="/dashboard/clusters"
                        onClick={() => { setSearchFocused(false); }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors ${
                          isActive ? "active-search-item bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <Server className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{cl.name}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            Status: {cl.status} {cl.provider ? `· ${cl.provider}` : ""}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Rules */}
              {filteredRules.length > 0 && (
                <div className="p-2">
                  <div className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                    Alert Rules
                  </div>
                  {filteredRules.map((ru: any, i) => {
                    const globalIdx = filteredPages.length + filteredIncidents.length + filteredClusters.length + i;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <Link
                        key={ru.rule_id}
                        href="/dashboard/rules"
                        onClick={() => { setSearchFocused(false); }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors ${
                          isActive ? "active-search-item bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{ru.name}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            {ru.description || "No description"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Channels */}
              {filteredChannels.length > 0 && (
                <div className="p-2">
                  <div className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                    Alert Channels
                  </div>
                  {filteredChannels.map((ch: any, i) => {
                    const globalIdx = filteredPages.length + filteredIncidents.length + filteredClusters.length + filteredRules.length + i;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <Link
                        key={ch.channel_id}
                        href="/settings/channels"
                        onClick={() => { setSearchFocused(false); }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors ${
                          isActive ? "active-search-item bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{ch.name}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            Type: {ch.type} · {ch.enabled ? "Active" : "Disabled"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!searchLoading && query && !hasResults && (
            <div className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-400">No results found</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">No resources matched "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
