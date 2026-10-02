"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Compass, X, ChevronRight, ChevronLeft, Sparkles, AlertCircle, Info, BookOpen, Play, Pause } from "lucide-react";

interface TourStep {
  selector?: string;
  title: string;
  description: string;
}

export const TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      title: "Welcome to Srevox DB Auditor! 👋",
      description: "Srevox DB Auditor is an enterprise-grade database change intelligence and CDC audit platform. It monitors database mutations in real-time, inspects before/after row diffs, masks PII, and maintains an immutable compliance ledger.",
    },
    {
      selector: "#connectors-bar",
      title: "Monitored Database Connectors 🗄️",
      description: "Connect PostgreSQL WAL, MySQL Binlog, MongoDB Oplog, and Redis Keyspace sources with zero query overhead using log-based CDC replication.",
    },
    {
      selector: "#audit-stats-grid",
      title: "Mutation Velocity & Security KPIs 📊",
      description: "Track total active database connectors, captured mutation events, in-memory PII masking policies, and SHA-256 cryptographic compliance verification at a glance.",
    },
    {
      selector: "#audit-events-list",
      title: "Live CDC Mutation Stream ⚡",
      description: "Inspect real-time INSERT, UPDATE, and DELETE row mutations. Click on any mutation record to open the interactive side-by-side Before/After diff viewer.",
    },
  ],
  "/dashboard/connectors": [
    {
      title: "CDC Live Stream & Compliance Ledger ⚡",
      description: "Continuous real-time stream of all row-level mutations across your databases with automated field-level diff detection and PII hashing.",
    },
    {
      selector: "#add-connector-btn",
      title: "Connect Database Source ➕",
      description: "Click here to add a new database connector. Choose from PostgreSQL, MySQL, MongoDB, Redis, ClickHouse, TiDB, or OceanBase.",
    },
    {
      selector: "#audit-filter-bar",
      title: "Search & Mutation Filters 🔍",
      description: "Filter captured CDC events by database name, specific tables, or mutation operation type (INSERT, UPDATE, DELETE).",
    },
    {
      selector: "#audit-events-list",
      title: "Row-Level Diff Inspector 📝",
      description: "Select any audit event to inspect the exact column modifications, masked PII credentials, commit timestamps, and cryptographic record hashes.",
    },
  ],
  "/dashboard/notifications": [
    {
      title: "Database Mutation Alerts & Notifications 🔔",
      description: "A chronological feed of real-time row-level mutations, schema modifications, and audit triggers across your monitored databases.",
    },
    {
      selector: "#notifications-filter-bar",
      title: "Filter Mutation Events 🔍",
      description: "Quickly toggle your feed between all events, unread mutation alerts, critical DELETE operations, or live UPDATE/INSERT streams.",
    },
    {
      selector: "#notifications-list-feed",
      title: "Real-time Mutation Events Log 📋",
      description: "Browse detailed change records. Mark alerts as read, silence non-critical notifications, or click 'Ledger' to jump directly to the before/after diff.",
    },
  ],
  "/settings/retention": [
    {
      title: "Data Retention & Compliance Ledger ⏱️",
      description: "Configure automated ledger retention schedules and purge intervals for database change events and system audit logs.",
    },
    {
      selector: "#retention-policy-card",
      title: "Audit Events Retention Window 📅",
      description: "Set the maximum age threshold for CDC mutation records (e.g. 30 days, 90 days, 1 year, or keep indefinitely). Older records are automatically queued for deletion.",
    },
    {
      selector: "#retention-interval-card",
      title: "Purge Execution Frequency ⚙️",
      description: "Configure the background automated cron sweep interval (e.g. hourly, every 6 hours, daily) to clean up stale audit ledgers.",
    },
    {
      selector: "#retention-runs-list",
      title: "Purge Execution History 📋",
      description: "Review historical automated and manual purge sweep executions, timestamps, and total deleted items.",
    },
  ],
  "/settings/channels": [
    {
      title: "Alert Routing Channels 🔔",
      description: "Configure workspace-wide communication channels to receive real-time notifications on critical schema alterations and mutation anomalies.",
    },
    {
      selector: "#add-channel-btn",
      title: "Add Notification Channel ➕",
      description: "Click here to add a channel. Supports direct SMTP Email, Microsoft Teams Workflows (Power Automate), Slack Webhooks, or Twilio/Meta WhatsApp.",
    },
    {
      selector: "#channels-list",
      title: "Channel Subscriptions & Integration Tests 🧪",
      description: "Manage channel configurations and click 'Test' to instantly dispatch a simulated test alert to verify credentials and connectivity.",
    },
  ],
  "/settings/team": [
    {
      title: "Team Members & Access Control 👥",
      description: "Invite team members to Srevox DB Auditor, manage administrator credentials, and assign roles.",
    },
    {
      selector: "#team-create-member-btn",
      title: "Invite a User ➕",
      description: "Create new member profiles with temporary credentials and assign them Admin, Member, or Viewer roles.",
    },
    {
      selector: "#team-roles-guide",
      title: "RBAC Role Profiles 📜",
      description: "Review permissions: Admins control database connectors and retention policies, Members manage live streams/AI, and Viewers have read-only inspection.",
    },
    {
      selector: "#team-members-list",
      title: "Members Directory 📋",
      description: "Browse team members, modify roles, reset passwords, or revoke platform access.",
    },
  ],
  "/settings/groups": [
    {
      title: "User Groups Manager 👥",
      description: "Group teammates together to simplify database access administration. Group members automatically inherit shared policies.",
    },
    {
      selector: "#groups-search",
      title: "Search Groups 🔍",
      description: "Quickly locate specific user groups by name or description keywords.",
    },
    {
      selector: "#create-group-btn",
      title: "Create a User Group ➕",
      description: "Click here to create a new group, specify its name, description, assign members, and set permissions.",
    },
    {
      selector: "#groups-list",
      title: "Configured Groups List 📋",
      description: "Review group configurations, edit assigned members, update policy settings, or delete groups.",
    },
  ],
  "/settings/permissions": [
    {
      title: "User Permissions & Capability Matrix 🛡️",
      description: "Fine-tune granular permissions for individual team members to override default role capabilities.",
    },
    {
      selector: "#permissions-search",
      title: "Search Member Capabilities 🔍",
      description: "Find specific team members by name or email using the real-time search filter.",
    },
    {
      selector: "#permissions-table",
      title: "Permissions Matrix 📋",
      description: "View permission modes. Click 'Edit Custom' on any user to modify specific capabilities like managing connectors, changing retention, or viewing audit logs.",
    },
  ],
  "/settings/org": [
    {
      title: "Organization & Multi-Tenancy 🏢",
      description: "Manage global workspace identity and database security parameters. Only Admin users can modify these settings.",
    },
    {
      selector: "#org-details-card",
      title: "Organization Profile 📋",
      description: "View and edit your organization workspace name and unique multi-tenant slug identifier.",
    },
    {
      selector: "#danger-zone-card",
      title: "Administrative Security & Danger Zone ⚠️",
      description: "Perform sensitive administrative operations including global workspace security and credential rotation.",
    },
  ],
  "/settings/activity": [
    {
      title: "Platform Audit Logs 📜",
      description: "A centralized audit ledger of all administrative actions, user logins, connector updates, and policy adjustments across your workspace.",
    },
    {
      selector: "#activity-search",
      title: "Search Activity Logs 🔍",
      description: "Search system audit records by user email, action type, IP address, or affected resource.",
    },
    {
      selector: "#activity-list",
      title: "Action History Stream 📋",
      description: "Inspect chronological action logs with detailed JSON metadata and user identity tracking.",
    },
  ],
  "/settings/appearance": [
    {
      title: "Theme & Appearance 🎨",
      description: "Customize your workspace interface with light and dark themes.",
    },
    {
      selector: "#appearance-theme-options",
      title: "Visual Theme Settings 🌓",
      description: "Switch seamlessly between sleek dark mode, daylight mode, or custom accent themes.",
    },
  ],
  "/settings/profile": [
    {
      title: "Profile & Security 👤",
      description: "Manage your personal account credentials, email, and password security.",
    },
    {
      selector: "#settings-profile",
      title: "Account Profile 👤",
      description: "Update your full name, email address, and view your current workspace role.",
    },
    {
      selector: "#settings-password",
      title: "Password & Security 🔑",
      description: "Keep your account secure with regular password updates.",
    },
    {
      selector: "#settings-session",
      title: "Session Management 🚪",
      description: "Sign out securely from your current active session on this device.",
    },
  ],
  "/settings/updates": [
    {
      title: "Platform Updates & Deployment 🚀",
      description: "Check your active Srevox DB Auditor version, discover new production releases, and run single-command deployment upgrades.",
    },
  ],
  "/settings/demo": [
    {
      title: "Demo Sandbox & Guided Walkthrough 🧭",
      description: "Experience the full capabilities of Srevox DB Auditor in an interactive simulator environment.",
    },
  ],
};

const DEFAULT_TOUR: TourStep[] = [
  {
    title: "Srevox DB Auditor Tour Guide 🧭",
    description: "Welcome! Srevox DB Auditor captures database row mutations in real-time, highlights before/after diffs, masks PII, and streams audit alerts. Here is a brief 3-step guide to get started.",
  },
  {
    title: "1. Connect Database Sources 🗄️",
    description: "Navigate to the Dashboard to connect your PostgreSQL WAL, MySQL Binlog, MongoDB Oplog, or Redis Keyspace CDC sources.",
  },
  {
    title: "2. Inspect CDC Live Stream & Diffs ⚡",
    description: "View real-time row mutations with side-by-side before/after column diffs, PII masked attributes, and cryptographic SHA-256 validation.",
  },
  {
    title: "3. Configure Alert Channels & Retention 🔔",
    description: "Set up Email, Teams, WhatsApp, or Webhook alert channels and configure automated data retention purge policies in Settings.",
  },
];

const TOUR_SEQUENCE = [
  "/dashboard",
  "/dashboard/connectors",
  "/dashboard/notifications",
  "/settings/retention",
  "/settings/channels",
  "/settings/team",
  "/settings/groups",
  "/settings/permissions",
  "/settings/org",
  "/settings/activity",
  "/settings/updates",
  "/settings/profile",
  "/settings/demo",
];

const SETTINGS_TOUR_SEQUENCE = [
  "/settings/profile",
  "/settings/appearance",
  "/settings/retention",
  "/settings/channels",
  "/settings/team",
  "/settings/permissions",
  "/settings/groups",
  "/settings/org",
  "/settings/activity",
  "/settings/updates",
  "/settings/demo",
];

const matchPathIndex = (sequence: string[], path: string | null): number => {
  if (!path) return -1;
  return sequence.findIndex((item) => item === path);
};

export default function PageTutorial() {
  const pathname = usePathname();
  const router = useRouter();

  const isAutopilot = typeof window !== "undefined" && localStorage.getItem("sv_autopilot_tour_active") === "true";
  const stepDuration = 7;

  const getTourSequence = useCallback(() => {
    if (typeof window !== "undefined" && localStorage.getItem("sv_settings_tour_active") === "true") {
      return SETTINGS_TOUR_SEQUENCE;
    }
    return TOUR_SEQUENCE;
  }, []);

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [timeLeft, setTimeLeft] = useState(stepDuration);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sv_tour_speed");
      if (saved) return Number(saved);
    }
    return 1;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_tour_speed", String(playbackSpeed));
    }
  }, [playbackSpeed]);

  const [isAutopilotExecuting, setIsAutopilotExecuting] = useState(false);

  const shouldHide =
    pathname === "/settings/engineering" ||
    pathname?.startsWith("/settings/engineering");

  const getSteps = useCallback((): TourStep[] => {
    const keys = Object.keys(TOURS);
    const match = keys.find(
      (k) =>
        pathname === k ||
        (k !== "/dashboard" && pathname?.startsWith(k))
    );
    return match ? TOURS[match] : DEFAULT_TOUR;
  }, [pathname]);

  const steps = getSteps();
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (active && currentStep) {
      window.dispatchEvent(new CustomEvent("sv_tour_step", { detail: { selector: currentStep.selector } }));
    }
  }, [active, currentStep]);

  const updateTargetCoordinates = useCallback(() => {
    if (!active || !currentStep?.selector) {
      setTargetRect(null);
      return;
    }
    const element = document.querySelector(currentStep.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        return;
      }
    }
    setTargetRect(null);
  }, [active, currentStep]);

  useEffect(() => {
    if (!active || !currentStep?.selector) return;

    const timer = setTimeout(() => {
      const element = document.querySelector(currentStep.selector!);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [stepIndex, pathname, active, currentStep?.selector]);

  useEffect(() => {
    if (!active) return;
    updateTargetCoordinates();

    const handleResizeOrScroll = () => {
      updateTargetCoordinates();
    };

    window.addEventListener("scroll", handleResizeOrScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleResizeOrScroll, { passive: true });

    const interval = setInterval(updateTargetCoordinates, 250);

    return () => {
      window.removeEventListener("scroll", handleResizeOrScroll, { capture: true });
      window.removeEventListener("resize", handleResizeOrScroll);
      clearInterval(interval);
    };
  }, [active, updateTargetCoordinates]);

  const startTour = useCallback((isSmartAutoPilot = false, isSettings = false) => {
    try {
      localStorage.setItem("sv_tour_completed", "false");
      if (isSettings) {
        localStorage.setItem("sv_settings_tour_active", "true");
      } else {
        localStorage.removeItem("sv_settings_tour_active");
      }

      if (isSmartAutoPilot) {
        localStorage.setItem("sv_autopilot_tour_active", "true");
        localStorage.setItem("sv_tour_speed", "1.25");
        setPlaybackSpeed(1.25);
      } else {
        localStorage.removeItem("sv_autopilot_tour_active");
      }

      localStorage.setItem("sv_auto_tour_active", "true");
      localStorage.setItem("sv_auto_tour_page_index", "0");

      setActive(true);
      setStepIndex(0);
      setTimeLeft(stepDuration);
      setAutoPlay(isSmartAutoPilot);
    } catch (e) {
      console.error(e);
    }
  }, [stepDuration]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      const sequence = getTourSequence();
      const idx = matchPathIndex(sequence, pathname);
      if (idx !== -1 && idx < sequence.length - 1) {
        const nextPage = sequence[idx + 1];
        if (typeof window !== "undefined") {
          localStorage.setItem("sv_auto_tour_active", "true");
          localStorage.setItem("sv_auto_tour_page_index", String(idx + 1));
        }
        router.push(nextPage);
        return;
      }
      endTour();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const endTour = () => {
    setActive(false);
    setAutoPlay(false);
    try {
      localStorage.setItem("sv_tour_completed", "true");

      const saved = localStorage.getItem("sv_completed_tours");
      let completed: Record<string, boolean> = {};
      if (saved) {
        try {
          completed = JSON.parse(saved);
        } catch {}
      }
      completed[pathname || ""] = true;
      localStorage.setItem("sv_completed_tours", JSON.stringify(completed));

      const isSmart = localStorage.getItem("sv_autopilot_tour_active") === "true";

      localStorage.removeItem("sv_auto_tour_active");
      localStorage.removeItem("sv_auto_tour_page_index");
      localStorage.removeItem("sv_autopilot_tour_active");
      localStorage.removeItem("sv_settings_tour_active");

      localStorage.removeItem("sv_mock_connectors");
      localStorage.removeItem("sv_mock_audit_events");
      localStorage.removeItem("sv_mock_channels");
      localStorage.removeItem("sv_mock_retention_db_audit");
      localStorage.removeItem("sv_mock_initialized");
      localStorage.removeItem("sv_backend_offline");

      if (localStorage.getItem("sv_token") === "mock-token-session") {
        localStorage.removeItem("sv_token");
        localStorage.removeItem("lz_user");
      }

      window.dispatchEvent(new Event("sv_tour_status_changed"));
      if (isSmart) {
        window.location.href = "/settings/demo";
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setAutoPlay((prev) => !prev);
      } else if (e.key === "Escape" || e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        endTour();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [active]);

  useEffect(() => {
    const handleStartTour = () => {
      startTour();
    };
    const handleStartAutoTour = () => {
      startTour(true);
    };

    window.addEventListener("sv_start_tour", handleStartTour);
    window.addEventListener("sv_start_auto_tour", handleStartAutoTour);

    return () => {
      window.removeEventListener("sv_start_tour", handleStartTour);
      window.removeEventListener("sv_start_auto_tour", handleStartAutoTour);
    };
  }, [startTour]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAutoActive = localStorage.getItem("sv_auto_tour_active") === "true";
      if (isAutoActive) {
        const sequence = getTourSequence();
        const idx = matchPathIndex(sequence, pathname);
        if (idx !== -1) {
          localStorage.setItem("sv_auto_tour_page_index", String(idx));
          const isSmart = localStorage.getItem("sv_autopilot_tour_active") === "true";
          setActive(true);
          setAutoPlay(isSmart);
          setStepIndex(0);
          setTimeLeft(stepDuration);
        }
      }
    }
  }, [pathname, stepDuration, getTourSequence, startTour]);

  useEffect(() => {
    if (active) {
      setTimeLeft(stepDuration);
    }
  }, [stepIndex, pathname, active, stepDuration]);

  useEffect(() => {
    if (!active || !autoPlay || isAutopilotExecuting) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(timer);
  }, [active, autoPlay, isAutopilotExecuting, playbackSpeed]);

  // Autopilot Actions effect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAutopilotActive = localStorage.getItem("sv_autopilot_tour_active") === "true";
      if (!isAutopilotActive || !active || !autoPlay) return;

      let activeEffect = true;

      const delay = (ms: number) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, ms);
        });
      };

      const waitForElement = (selector: string, timeout = 3000): Promise<HTMLElement | null> => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const check = () => {
            if (!activeEffect) {
              resolve(null);
              return;
            }
            const el = document.querySelector(selector) as HTMLElement;
            if (el) {
              resolve(el);
            } else if (Date.now() - startTime >= timeout) {
              resolve(null);
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
      };

      const waitForButtonWithText = (text: string, timeout = 3000): Promise<HTMLElement | null> => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const check = () => {
            if (!activeEffect) {
              resolve(null);
              return;
            }
            const btn = Array.from(document.querySelectorAll("button")).find(
              (b) => b.textContent?.includes(text)
            ) as HTMLElement;
            if (btn) {
              resolve(btn);
            } else if (Date.now() - startTime >= timeout) {
              resolve(null);
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
      };

      const simulateTyping = (input: HTMLElement, text: string) => {
        if (!activeEffect) return;
        const htmlInput = input as HTMLInputElement | HTMLTextAreaElement;
        htmlInput.value = text;
        const tracker = (htmlInput as any)._valueTracker;
        if (tracker) tracker.setValue("");
        htmlInput.dispatchEvent(new Event("input", { bubbles: true }));
        htmlInput.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const runAutopilotAction = async () => {
        setIsAutopilotExecuting(true);
        try {
          // 1. Data Audit Page autopilot actions
          if (pathname === "/dashboard/connectors" || pathname === "/dashboard") {
            if (stepIndex === 1) {
              const addBtn = await waitForElement("#add-connector-btn");
              if (addBtn) {
                addBtn.click();
                await delay(1200);
                const closeBtn = await waitForButtonWithText("Cancel");
                if (closeBtn) {
                  closeBtn.click();
                }
              }
            }
          }

          // 2. Channels Page autopilot actions
          if (pathname === "/settings/channels") {
            if (stepIndex === 1) {
              const addBtn = await waitForElement("#add-channel-btn");
              if (addBtn) {
                addBtn.click();
                await delay(1200);
                const closeBtn = await waitForButtonWithText("Cancel");
                if (closeBtn) {
                  closeBtn.click();
                }
              }
            }
          }
        } catch (err) {
          console.error("Autopilot error:", err);
        } finally {
          if (activeEffect) {
            setIsAutopilotExecuting(false);
          }
        }
      };

      runAutopilotAction();
      return () => {
        activeEffect = false;
      };
    }
  }, [pathname, stepIndex, active, autoPlay]);

  // Handle auto-advancing when timeLeft hits 0
  useEffect(() => {
    if (active && autoPlay && timeLeft === 0) {
      if (stepIndex < steps.length - 1) {
        setStepIndex((idx) => idx + 1);
        setTimeLeft(stepDuration);
      } else {
        const sequence = getTourSequence();
        const idx = matchPathIndex(sequence, pathname);
        if (idx !== -1 && idx < sequence.length - 1) {
          const nextPage = sequence[idx + 1];
          if (typeof window !== "undefined") {
            localStorage.setItem("sv_auto_tour_page_index", String(idx + 1));
          }
          router.push(nextPage);
        } else {
          endTour();
        }
      }
    }
  }, [active, autoPlay, timeLeft, stepIndex, steps.length, pathname, stepDuration, getTourSequence, router]);

  // Calculate coordinates and style for Guide Card
  const getCardStyle = (): React.CSSProperties => {
    if (targetRect) {
      const cardWidth = 380;
      const cardHeight = 240;
      const buffer = 16;
      let top = targetRect.bottom + buffer;
      let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;

      if (left < buffer) {
        left = buffer;
      } else if (left + cardWidth > window.innerWidth - buffer) {
        left = window.innerWidth - cardWidth - buffer;
      }

      const spaceBelow = window.innerHeight - targetRect.bottom;
      if (spaceBelow < cardHeight + buffer * 2) {
        top = targetRect.top - cardHeight - buffer;
        if (top < buffer) {
          return {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            position: "fixed",
          };
        }
      }

      return {
        top: `${top}px`,
        left: `${left}px`,
        position: "fixed",
      };
    }

    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      position: "fixed",
    };
  };

  if (!active || shouldHide) {
    return null;
  }

  const cardStyle = getCardStyle();

  return (
    <div className="fixed inset-0 z-[9997] select-none">
      {/* SVG Spotlight Cutout Backdrop */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[9997]">
        <defs>
          <mask id="spotlight-cutout-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(8, 10, 18, 0.65)"
          mask="url(#spotlight-cutout-mask)"
          className="pointer-events-auto cursor-default"
        />
      </svg>

      {/* Target Focus Border Glow overlay */}
      {targetRect && (
        <div
          className="fixed z-[9998] border-2 border-indigo-500 rounded-xl pointer-events-none transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)] animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Walkthrough Guide Card */}
      <div
        className="w-[380px] max-w-[90vw] bg-white/95 dark:bg-[#131520]/95 border border-indigo-100/80 dark:border-slate-800/90 rounded-3xl shadow-[0_20px_50px_rgba(99,102,241,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 flex flex-col justify-between backdrop-blur-lg z-[9999] transition-all duration-300"
        style={cardStyle}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 text-indigo-600 dark:text-indigo-400">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: "3s" }} />
                <span>DB Auditor Guide</span>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-md">
                Step {stepIndex + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={endTour}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
              title="Skip Tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Body */}
          <div className="space-y-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              {currentStep?.title}
            </h3>
            <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed font-normal">
              {currentStep?.description}
            </p>

            {/* Auto-Play status banner */}
            {isAutopilot && autoPlay && (
              <div className="mt-2.5 px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl flex items-center justify-between text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 select-none">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500 animate-pulse"></span>
                  </span>
                  <span>Auto-playing (next in {timeLeft}s)</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex border border-gray-200 dark:border-slate-700/85 rounded-lg overflow-hidden shadow-sm">
                    {[0.5, 1, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold transition-all ${
                          playbackSpeed === speed
                            ? "bg-indigo-600 text-white"
                            : "bg-white dark:bg-slate-800 text-gray-550 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-750"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setAutoPlay(false)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-55 dark:hover:bg-slate-700 text-[10px] text-indigo-650 dark:text-indigo-400 transition shadow-sm"
                  >
                    <Pause className="w-2.5 h-2.5" /> Pause
                  </button>
                </div>
              </div>
            )}

            {isAutopilot && !autoPlay && (
              <div className="mt-2.5 px-3 py-1.5 bg-amber-55/10 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/15 rounded-xl flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-455 select-none">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Tour auto-play is paused</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex border border-gray-200 dark:border-slate-700/85 rounded-lg overflow-hidden shadow-sm">
                    {[0.5, 1, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold transition-all ${
                          playbackSpeed === speed
                            ? "bg-indigo-600 text-white"
                            : "bg-white dark:bg-slate-800 text-gray-550 dark:text-slate-400 hover:bg-gray-55 dark:hover:bg-slate-750"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setAutoPlay(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-55 dark:hover:bg-slate-700 text-[10px] text-amber-655 dark:text-amber-400 transition shadow-sm"
                  >
                    <Play className="w-2.5 h-2.5" /> Resume
                  </button>
                </div>
              </div>
            )}

            {!isAutopilot && active && typeof window !== "undefined" && localStorage.getItem("sv_auto_tour_active") === "true" && (
              <div className="mt-2.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-900/30 border border-gray-150 dark:border-slate-800/60 rounded-xl flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-slate-400 select-none">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                  </span>
                  <span>Manual Tour Mode (Click Next to advance)</span>
                </span>
              </div>
            )}

            {/* Animated Progress Bar */}
            {autoPlay && (
              <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 overflow-hidden shrink-0 mt-3 rounded-full">
                <div 
                  className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all ease-linear"
                  style={{ 
                    width: `${(timeLeft / stepDuration) * 100}%`,
                    transitionDuration: `${1000 / playbackSpeed}ms`
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between">
          {/* Pagination Indicators */}
          <div className="flex gap-1.5 items-center">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-350 ${
                  idx === stepIndex ? "w-4 bg-indigo-500" : "w-1.5 bg-gray-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="btn-secondary py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-slate-850"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="btn-primary py-1.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <span>
                {stepIndex === steps.length - 1 
                  ? (() => {
                      const sequence = getTourSequence();
                      const idx = matchPathIndex(sequence, pathname);
                      if (idx !== -1 && idx < sequence.length - 1) {
                        return "Next Page";
                      }
                      return "Finish";
                    })()
                  : "Next"}
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
