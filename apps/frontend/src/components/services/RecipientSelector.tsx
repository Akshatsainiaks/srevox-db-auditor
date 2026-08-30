"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, User, Users, FolderHeart, Mail } from "lucide-react";

interface UserItem {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

interface GroupItem {
  group_id: string;
  name: string;
  description?: string;
}

interface NotificationGroupItem {
  group_id: string;
  name: string;
  emails?: string | string[];
}

interface RecipientSelectorProps {
  value: string;
  onChange: (value: string) => void;
  allUsers: UserItem[];
  allGroups: GroupItem[];
  notificationGroups: NotificationGroupItem[];
  placeholder?: string;
  allowedTypes?: ("user" | "group" | "notification_group" | "email")[];
}

export default function RecipientSelector({
  value,
  onChange,
  allUsers = [],
  allGroups = [],
  notificationGroups = [],
  placeholder = "Select users, groups, or notification groups...",
  allowedTypes,
}: RecipientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allowed = allowedTypes || ["user", "group", "notification_group", "email"];

  // Parse comma-separated string into items list
  const activeIds = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search]);

  const resolveItem = (id: string) => {
    if (id.includes("@")) {
      return { id, label: id, type: "email" as const };
    }
    if (id.startsWith("ngp")) {
      const ng = notificationGroups.find((g) => g.group_id === id);
      return { id, label: ng ? ng.name : id, type: "notification_group" as const };
    }
    if (id.startsWith("usr")) {
      const u = allUsers.find((user) => user.user_id === id);
      return {
        id,
        label: u ? u.full_name : id,
        email: u?.email,
        type: "user" as const,
      };
    }
    const g = allGroups.find((group) => group.group_id === id);
    return { id, label: g ? g.name : id, type: "group" as const };
  };

  const addItem = (id: string) => {
    if (!activeIds.includes(id)) {
      onChange([...activeIds, id].join(", "));
    }
    setSearch("");
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const removeItem = (idToRemove: string) => {
    onChange(activeIds.filter((id) => id !== idToRemove).join(", "));
  };

  // Filter dropdown lists
  const filteredUsers = allUsers.filter(
    (u) =>
      !activeIds.includes(u.user_id) &&
      (u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredGroups = allGroups.filter(
    (g) =>
      !activeIds.includes(g.group_id) &&
      g.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNotifGroups = notificationGroups.filter(
    (ng) =>
      !activeIds.includes(ng.group_id) &&
      ng.name.toLowerCase().includes(search.toLowerCase())
  );

  // Compile a flat list of selectable items for keyboard indexing
  const selectableOptions: { id: string; label: string; type: string }[] = [];
  
  if (allowed.includes("email") && search.includes("@")) {
    selectableOptions.push({ id: search.trim(), label: `Add custom email: ${search.trim()}`, type: "email" });
  }

  if (allowed.includes("notification_group")) {
    filteredNotifGroups.forEach(ng => {
      selectableOptions.push({ id: ng.group_id, label: ng.name, type: "notification_group" });
    });
  }
  
  if (allowed.includes("group")) {
    filteredGroups.forEach(g => {
      selectableOptions.push({ id: g.group_id, label: g.name, type: "group" });
    });
  }
  
  if (allowed.includes("user")) {
    filteredUsers.forEach(u => {
      selectableOptions.push({ id: u.user_id, label: u.full_name, type: "user" });
    });
  }

  // Reset active index when search or lists change
  useEffect(() => {
    setActiveIndex(0);
  }, [search, activeIds.length]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && search === "" && activeIds.length > 0) {
      removeItem(activeIds[activeIds.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      if (selectableOptions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % selectableOptions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      if (selectableOptions.length > 0) {
        setActiveIndex((prev) => (prev - 1 + selectableOptions.length) % selectableOptions.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && selectableOptions[activeIndex]) {
        addItem(selectableOptions[activeIndex].id);
      } else {
        setSearch("");
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Handle when input field loses focus
  const handleBlur = () => {
    // Timeout gives pending click handlers on options/buttons time to process
    setTimeout(() => {
      setIsOpen(false);
      setSearch("");
    }, 120);
  };

  // Scroll highlighted option into view inside the dropdown panel
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const container = dropdownRef.current;
    const activeEl = container.querySelector("[data-active='true']");
    if (activeEl) {
      const cTop = container.scrollTop;
      const cBottom = cTop + container.clientHeight;
      const elTop = (activeEl as HTMLElement).offsetTop;
      const elBottom = elTop + (activeEl as HTMLElement).clientHeight;

      if (elTop < cTop) {
        container.scrollTop = elTop - 8;
      } else if (elBottom > cBottom) {
        container.scrollTop = elBottom - container.clientHeight + 8;
      }
    }
  }, [activeIndex, isOpen]);

  const hasOptions =
    (allowed.includes("user") && filteredUsers.length > 0) ||
    (allowed.includes("group") && filteredGroups.length > 0) ||
    (allowed.includes("notification_group") && filteredNotifGroups.length > 0) ||
    (allowed.includes("email") && search.includes("@"));

  return (
    <div ref={containerRef} className="relative w-full text-left">
      {/* Selector input area displaying active chips */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className="flex flex-wrap gap-1.5 p-2 min-h-[42px] border rounded-xl bg-white dark:bg-[#13151f] border-gray-200 dark:border-slate-800/80 focus-within:border-indigo-500 dark:focus-within:border-indigo-500/85 focus-within:ring-2 focus-within:ring-indigo-500/10 cursor-text transition-all"
      >
        {activeIds.map((id) => {
          const item = resolveItem(id);
          let badgeColor =
            "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border-gray-150 dark:border-slate-800";
          let Icon = Users;

          if (item.type === "email") {
            badgeColor =
              "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-450 border-teal-100 dark:border-teal-500/20";
            Icon = Mail;
          } else if (item.type === "user") {
            badgeColor =
              "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20";
            Icon = User;
          } else if (item.type === "group") {
            badgeColor =
              "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20";
            Icon = Users;
          } else if (item.type === "notification_group") {
            badgeColor =
              "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-100 dark:border-purple-500/20";
            Icon = FolderHeart;
          }

          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border font-semibold ${badgeColor}`}
            >
              <Icon className="w-3.5 h-3.5 opacity-70" />
              <span>
                {item.label}
                {item.type === "user" && item.email && (
                  <span className="opacity-60 text-[10px] font-normal font-sans ml-1">
                    ({item.email})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(id);
                }}
                className="w-3.5 h-3.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3 text-current" />
              </button>
            </span>
          );
        })}

        {/* Typing area */}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] bg-transparent border-0 outline-none p-0.5 text-xs text-gray-800 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-600"
          placeholder={activeIds.length === 0 ? placeholder : ""}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>

      {/* Floating search dropdown panel */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#1e2130] border border-gray-150 dark:border-slate-800/80 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 p-2 divide-y divide-gray-100 dark:divide-slate-800/60 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Custom email option if search contains '@' */}
          {allowed.includes("email") && search.includes("@") && (
            <div className="py-1">
              {(() => {
                const isActive = activeIndex === 0;
                return (
                  <button
                    type="button"
                    data-active={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addItem(search.trim())}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors font-semibold ${
                      isActive 
                        ? "bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/20" 
                        : "text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-teal-500" />
                      Add custom email: {search.trim()}
                    </span>
                  </button>
                );
              })()}
            </div>
          )}

          {/* Notification Groups section */}
          {allowed.includes("notification_group") && filteredNotifGroups.length > 0 && (
            <div className="py-1">
              <span className="px-2.5 py-1 text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Notification Groups
              </span>
              {filteredNotifGroups.map((ng) => {
                const optIndex = selectableOptions.findIndex(o => o.id === ng.group_id);
                const isActive = optIndex === activeIndex;
                
                return (
                  <button
                    key={ng.group_id}
                    type="button"
                    data-active={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addItem(ng.group_id)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors font-medium ${
                      isActive 
                        ? "bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/20" 
                        : "text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FolderHeart className="w-3.5 h-3.5 text-purple-500" />
                      {ng.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* RBAC Groups section */}
          {allowed.includes("group") && filteredGroups.length > 0 && (
            <div className="py-1">
              <span className="px-2.5 py-1 text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Groups
              </span>
              {filteredGroups.map((g) => {
                const optIndex = selectableOptions.findIndex(o => o.id === g.group_id);
                const isActive = optIndex === activeIndex;
                
                return (
                  <button
                    key={g.group_id}
                    type="button"
                    data-active={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addItem(g.group_id)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors font-medium ${
                      isActive 
                        ? "bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/20" 
                        : "text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      {g.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Users section */}
          {allowed.includes("user") && filteredUsers.length > 0 && (
            <div className="py-1">
              <span className="px-2.5 py-1 text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Users
              </span>
              {filteredUsers.map((u) => {
                const optIndex = selectableOptions.findIndex(o => o.id === u.user_id);
                const isActive = optIndex === activeIndex;
                
                return (
                  <button
                    key={u.user_id}
                    type="button"
                    data-active={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addItem(u.user_id)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors font-medium ${
                      isActive 
                        ? "bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/20" 
                        : "text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="flex flex-col">
                        <span>{u.full_name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">
                          {u.email}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty search fallback */}
          {!hasOptions && (
            <div className="p-3.5 text-center text-xs text-gray-400 dark:text-slate-500 space-y-2">
              <p className="italic">
                {search === "" ? "No options available" : "No matching items found"}
              </p>
              <div className="flex flex-col gap-2 items-center justify-center pt-2.5 border-t border-gray-100 dark:border-slate-800/80">
                {allowed.includes("user") && (
                  <a
                    href="/settings/team"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 transition-colors"
                  >
                    + Invite/Manage Users
                  </a>
                )}
                {allowed.includes("group") && (
                  <a
                    href="/settings/groups"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 transition-colors"
                  >
                    + Manage User Groups
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
