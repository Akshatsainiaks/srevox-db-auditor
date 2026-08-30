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
      title: "Welcome to Srevox! 👋",
      description: "Srevox monitors, alerts, and diagnoses container restarts and OOM failures across your clusters in real-time. This guide will walk you through the key elements of the control dashboard.",
    },
    {
      selector: "#clusters-grid",
      title: "Infrastructure Clusters 🖥️",
      description: "Monitor the overall status of all connected environments. You can view total node configurations, pod capacity limits, and total active pod crashes immediately. Click a cluster card to drill down.",
    },
    {
      selector: "#recent-incidents",
      title: "Recent Incident Alerts 🚨",
      description: "View active CrashLoopBackOff and container exit logs sorted by latest event time. Click on any row to open the sidebar, inspect raw terminal stdout logs, and request AI diagnoses.",
    },
  ],
  "/dashboard/clusters": [
    {
      title: "Kubernetes Cluster Manager ⚙️",
      description: "View connected Kubernetes clusters. Srevox agents connect securely in read-only mode to poll pod statuses without write permissions.",
    },
    {
      selector: "#add-cluster-btn",
      title: "Connect a New Cluster ➕",
      description: "Click here to add a new cluster. Srevox generates a secure, custom kubectl command configuration containing a read-only manifest which you can apply directly inside your terminal.",
    },
    {
      selector: "#clusters-list",
      title: "Active Connections List 📋",
      description: "Review heartbeat health logs (updated every 10 seconds), API server latency, cluster version, and metrics streaming health. Click 'Edit Settings' to customize local warn alerts.",
    },
  ],
  "/settings/channels": [
    {
      title: "Alert Routing Channels 🔔",
      description: "Configure workspace-wide communication channels. Srevox forwards detailed incident maps containing crash logs directly to your team communication hubs.",
    },
    {
      selector: "#add-channel-btn",
      title: "Add a Notification Channel ➕",
      description: "Click here to add a channel. Supports SMTP Email (with secure SSL/TLS ports), Microsoft Teams Webhooks, Slack Webhooks, or Twilio/Meta WhatsApp configuration variables.",
    },
    {
      selector: "#channels-list",
      title: "Manage Deliveries & Integration Tests 🧪",
      description: "Manage channel subscriptions. Click the 'Test' button to instantly dispatch a simulated payload event to verify your webhook URLs and credentials before going live.",
    },
  ],
  "/dashboard/rules": [
    {
      title: "Alert Rules & Conditions 📜",
      description: "Custom rules block alert fatigue. Control precisely when alerts dispatch, filtering events based on clusters, namespaces, or pod naming patterns.",
    },
    {
      selector: "#add-rule-btn",
      title: "Create a Custom Alert Rule ➕",
      description: "Define rules. Enforce a 'Minimum Restart Count' (e.g. only alert if a pod restarts 3+ times within 5 minutes) and a cooldown duration (e.g., 10 minutes) to suppress duplicate noise.",
    },
    {
      selector: "#rules-list",
      title: "Configured Rules Feed 📋",
      description: "Review and edit rules. You can link each rule to multiple communication channels, or toggle rules to 'Paused' to prevent alerts during scheduled cluster maintenance.",
    },
  ],
  "/dashboard/incidents": [
    {
      title: "Incidents Feed & Crash History 📂",
      description: "Deep-dive into container crashes, restart history, and exit codes. Real-time updates populate the list automatically as failures occur on your clusters.",
    },
    {
      selector: "#incidents-filter",
      title: "Search & Filtering Controls 🔍",
      description: "Filter your incident log stream by status (open, acknowledged, resolved), crash severity levels, specific cluster environments, namespace filters, or pod search queries.",
    },
    {
      selector: "#incidents-list",
      title: "Detailed Incident Feed 📝",
      description: "Select an incident to view container exit codes, memory utilization percentages, pod log files, and request AI diagnoses to troubleshoot memory leaks or database timeouts.",
    },
  ],
  "/settings/profile": [
    {
      title: "Settings Workspace ⚙️",
      description: "Manage your personal account credentials, alert preferences, team members directory, and AI keys all within one unified settings area.",
    },
    {
      selector: "#settings-profile",
      title: "Personal Profile Settings 👤",
      description: "Update your full name, manage your email credentials (admin only), or modify security passwords. Save or Cancel modifications using toggle controls.",
    },
    {
      selector: "#settings-password",
      title: "Security & Passwords 🔑",
      description: "Keep your account secure by rotating your password regularly. Requires your current password to authorize updates.",
    },
    {
      selector: "#settings-session",
      title: "Session Management 🚪",
      description: "Safely sign out of your current Srevox session. Active configurations and preferences will remain saved under your profile.",
    },
  ],
  "/dashboard/notifications": [
    {
      title: "Incident Notifications Feed 🔔",
      description: "A chronological feed of recent pod restarts, failures, and container exit events triggered across your monitored cluster namespaces.",
    },
    {
      selector: "#notifications-filter-bar",
      title: "Filter Events 🔍",
      description: "Quickly toggle your logs view between all events, unread alerts, active crash events, or resolved incidents.",
    },
    {
      selector: "#notifications-list-feed",
      title: "Events Log 📋",
      description: "Browse detailed event records. Click on any event to mark it read, or select 'View details' to drill down into raw pod logs and diagnostic charts.",
    },
  ],
  "/cluster/infrastructure": [
    {
      title: "Infrastructure Live Telemetry 🖥️",
      description: "Monitor cluster-wide resource allocation. Tracks aggregate nodes and pods CPU/Memory telemetry metrics streaming in real-time.",
    },
    {
      selector: "#infra-metric-cards",
      title: "Cluster Metric Averages 📈",
      description: "Review average CPU, memory usage, total allocated pods, and identify hot master/worker nodes experiencing utilization spikes over 90% in real-time.",
    },
    {
      selector: "#infra-pods-list",
      title: "Real-time Pod Resource Usage ⚙️",
      description: "Monitor resources per pod. Filter by namespace to instantly discover heavy services or pods causing node memory starvation.",
    },
    {
      selector: "#infra-pods-search",
      title: "Search & Filter Pods 🔍",
      description: "Quickly locate specific pods or filter by namespace to drill down on targeted services and identify resource exhaustion.",
    },
  ],
  "/dashboard/services": [
    {
      title: "Service Alert Routing 👥",
      description: "Assign specific engineers to take ownership of individual Kubernetes namespaces or pod name prefix patterns.",
    },
    {
      selector: "#add-service-owner-btn",
      title: "Assign a Service Owner ➕",
      description: "Assign a service owner. Srevox will automatically route corresponding incident warnings directly to their personal channels.",
    },
    {
      selector: "#service-owners-list",
      title: "Active Assignments 📋",
      description: "Review current namespace ownership assignments. When alerts occur, they route to the owner's channels in addition to the global channel list.",
    },
  ],
  "/settings/team": [
    {
      title: "Team & Access Control 👥",
      description: "Invite team members to Srevox, manage email profiles (admin only), and assign user permissions.",
    },
    {
      selector: "#team-create-member-btn",
      title: "Invite a User ➕",
      description: "Invite a colleague by generating temporary login credentials. Assign them Viewer, Member, or Admin permissions.",
    },
    {
      selector: "#team-roles-guide",
      title: "Role Profiles 📜",
      description: "Review permissions: Admins control all settings and purge cluster data, Members manage incidents/AI, Viewers have read-only access.",
    },
    {
      selector: "#team-members-list",
      title: "Members Directory 📋",
      description: "View name and emails (searchable alphabetically). Admin accounts can change roles, reset passwords, or revoke access keys.",
    },
  ],
  "/settings/preferences": [
    {
      title: "Personal Alert Preferences ⚙️",
      description: "Customize which container warnings you personally want to receive. These filters apply to your assigned service alerts only.",
    },
    {
      selector: "#prefs-toggle",
      title: "Toggle Notifications 🔔",
      description: "Use this switch to pause all personal notifications. Org-level alerts remain operational.",
    },
    {
      selector: "#prefs-save",
      title: "Save Updates 💾",
      description: "Adjust severities filters, specific crash reasons, quiet hour intervals (UTC), and lifecycle resolutions. Click here to save.",
    },
  ],
  "/settings/org": [
    {
      title: "Organization Settings 🏢",
      description: "Manage global workspace preferences. Only users with the Admin role can access or modify these settings.",
    },
    {
      selector: "#org-details-card",
      title: "Organization Profile 📋",
      description: "View and edit organization name. Non-admin users are restricted from changing this value.",
    },
    {
      selector: "#danger-zone-card",
      title: "Danger Zone Controls ⚠️",
      description: "Perform sensitive administrative operations such as purging cluster configs, deleting incidents, or resetting databases here.",
    },
  ],
  "/dashboard/analytics": [
    {
      title: "System Analytics & Trends 📊",
      description: "Analyze cluster health, incident frequencies, and noise reduction rates. Spot recurring crash patterns and service anomalies.",
    },
    {
      selector: "#analytics-summary",
      title: "Key Metrics Summary 📈",
      description: "Track total incidents, mean time to resolve (MTTR), noise reduction ratios, and active alerting alerts status at a glance.",
    },
    {
      selector: "#analytics-charts-container",
      title: "Crashes vs. Alerts Trend 📉",
      description: "Visualize crash trends and alert dispatches side-by-side. Check your historical metrics to optimize alert rules.",
    }
  ],
  "/dashboard/services/features": [
    {
      title: "Service Owner Feature Settings ⚙️",
      description: "Customize global routing rules, fallback contact channels, and muting windows for service owner alerts.",
    },
    {
      selector: "#fallback-route-options",
      title: "Fallback Route Options 👥",
      description: "Configure fallback routing contact channels. These settings act as safety networks if an incident occurs on a service without assigned channels.",
    },
    {
      selector: "#global-service-muting",
      title: "Global Service Alert Muting 🔕",
      description: "Temporarily silence or disable all incoming service owner alerts. Enforce global maintenance windows here.",
    },
    {
      selector: "#service-route-mappings",
      title: "Service Mappings & Toggles 🗂️",
      description: "Browse the registered service owner endpoints, verify mapped Kubernetes namespaces, and toggle alerts silencing per microservice.",
    }
  ],
  "/settings/groups": [
    {
      title: "User Groups Manager 👥",
      description: "Group multiple teammates together to simplify permissions administration. Teammates added to a group inherit all group-level overrides automatically.",
    },
    {
      selector: "#groups-search",
      title: "Search Groups 🔍",
      description: "Locate specific user groups instantly by typing keywords from names or descriptions.",
    },
    {
      selector: "#create-group-btn",
      title: "Create a User Group ➕",
      description: "Click here to spawn a new group, specify its name and description, select member accounts, and assign base policy settings.",
    },
    {
      selector: "#groups-list",
      title: "Configured Groups List 📋",
      description: "Review, edit member configurations, update group-level permission locks, or delete group configurations from the active list.",
    }
  ],
  "/settings/permissions": [
    {
      title: "User Permissions Overrides 🛡️",
      description: "Customize granular permissions for individual team members. By default, access is governed by roles, but you can override capabilities here.",
    },
    {
      selector: "#permissions-search",
      title: "Search Member list 🔍",
      description: "Find specific members by name or email using the real-time search filter.",
    },
    {
      selector: "#permissions-table",
      title: "Permissions Directory 📋",
      description: "View permission modes. Click 'Edit Custom' on any user to open the override manager drawer and modify specific capabilities.",
    }
  ],
  "/settings/more-settings": [
    {
      title: "Advanced Administrative Settings ⚙️",
      description: "Configure data retention schedules, platform updates check intervals, and advanced administrative parameters.",
    },
    {
      selector: "#sudo-security-lock",
      title: "Sudo Security Passcode 🔑",
      description: "Update the global security password used to restrict access to sensitive administrative views such as Cluster Settings and Audit Logs.",
    },
    {
      selector: "#audit-logs-retention",
      title: "Audit Logs Retention 📂",
      description: "Manage database purge intervals for audit log ledgers and historical analytics datasets (located under the Audit Logs Retention tab).",
    }
  ]
};

const DEFAULT_TOUR: TourStep[] = [
  {
    title: "Srevox Tour Guide 🧭",
    description: "Welcome! Srevox is a Kubernetes observability platform that alerts on and diagnoses pod crash loops. Here is a brief 3-step guide to get started.",
  },
  {
    title: "1. Connect a Cluster 🖥️",
    description: "Navigate to the Clusters page to connect your Kubernetes environments. You can run the read-only agent or paste a read-only kubeconfig.",
  },
  {
    title: "2. Configure Alert Channels 🔔",
    description: "Set up Slack, Teams, Email, or WhatsApp channels in the Channels page. This ensures your team receives incident cards in real-time.",
  },
  {
    title: "3. Set Up Alert Rules 📜",
    description: "Use the Alert Rules page to filter out noise, specify crash reason criteria (e.g. OOMKilled), and route alert events to specific channels.",
  },
];

const TOUR_SEQUENCE = [
  "/dashboard",
  "/dashboard/clusters",
  "/settings/channels",
  "/dashboard/rules",
  "/dashboard/incidents",
  "/dashboard/services",
  "/dashboard/services/features",
  "/cluster/infrastructure",
  "/dashboard/analytics",
  "/dashboard/notifications",
  "/settings/profile",
  "/settings/more-settings"
];

const SETTINGS_TOUR_SEQUENCE = [
  "/settings/profile",
  "/settings/preferences",
  "/settings/channels",
  "/settings/team",
  "/settings/groups",
  "/settings/permissions",
  "/settings/org",
  "/settings/more-settings"
];

const matchPathIndex = (sequence: string[], path: string | null): number => {
  if (!path) return -1;
  return sequence.findIndex(item => {
    if (item === path) return true;
    if (item === "/cluster/infrastructure" && path.startsWith("/cluster/") && path.endsWith("/infrastructure")) return true;
    return false;
  });
};

const getTourClusterId = async (): Promise<string> => {
  try {
    const mockStr = localStorage.getItem("sv_mock_clusters");
    if (mockStr) {
      const mockCls = JSON.parse(mockStr);
      if (mockCls && mockCls[0]?.cluster_id) {
        return mockCls[0].cluster_id;
      }
    }
    const r = await api.get("/api/clusters");
    if (r.data?.clusters?.[0]?.cluster_id) {
      return r.data.clusters[0].cluster_id;
    }
  } catch (e) {
    console.error(e);
  }
  return "gcp-cluster-prod";
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

  // Sync playback speed to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sv_tour_speed", String(playbackSpeed));
    }
  }, [playbackSpeed]);

  const [isAutopilotExecuting, setIsAutopilotExecuting] = useState(false);

  // Hide the quick tour entirely on the engineering page and incident detail pages
  const shouldHide = 
    pathname === "/settings/engineering" ||
    pathname?.startsWith("/settings/engineering") ||
    (pathname?.startsWith("/dashboard/incidents/") && pathname !== "/dashboard/incidents");

  // Retrieve matching steps for current path or general fallback
  const getSteps = useCallback((): TourStep[] => {
    // Exact match or prefix match
    const keys = Object.keys(TOURS);
    const match = keys.find(k => 
      pathname === k || 
      (k !== "/dashboard" && pathname?.startsWith(k)) ||
      (k === "/cluster/infrastructure" && pathname?.startsWith("/cluster/") && pathname?.endsWith("/infrastructure"))
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

  // Compute bounding box coordinates of targeted element
  const updateTargetCoordinates = useCallback(() => {
    if (!active || !currentStep?.selector) {
      setTargetRect(null);
      return;
    }
    const element = document.querySelector(currentStep.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      // Ensure elements with 0 width/height default to null (not visible yet)
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        return;
      }
    }
    setTargetRect(null);
  }, [active, currentStep]);

  // Scroll to target element when step or page changes
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

  // Track scroll and resize shifts dynamically
  useEffect(() => {
    if (!active) return;
    updateTargetCoordinates();

    const handleResizeOrScroll = () => {
      updateTargetCoordinates();
    };

    window.addEventListener("scroll", handleResizeOrScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleResizeOrScroll, { passive: true });

    // Periodic coordinate sync loop to catch async loads or layout adjustments
    const interval = setInterval(updateTargetCoordinates, 250);

    return () => {
      window.removeEventListener("scroll", handleResizeOrScroll, { capture: true });
      window.removeEventListener("resize", handleResizeOrScroll);
      clearInterval(interval);
    };
  }, [active, updateTargetCoordinates]);

  // Handle tour activation
  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  // Next step
  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      const sequence = getTourSequence();
      const idx = matchPathIndex(sequence, pathname);
      if (idx !== -1 && idx < sequence.length - 1) {
        const nextPage = sequence[idx + 1];
        if (typeof window !== "undefined") {
          localStorage.setItem("sv_auto_tour_active", "true");
          localStorage.setItem("sv_auto_tour_page_index", String(idx + 1));
        }
        if (nextPage === "/cluster/infrastructure") {
          getTourClusterId().then(clusterId => {
            router.push(`/cluster/${clusterId}/infrastructure`);
          });
        } else {
          router.push(nextPage);
        }
        return;
      }
      endTour();
    }
  };

  // Previous step
  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1);
    }
  };

  // Complete tour
  const endTour = () => {
    setActive(false);
    setAutoPlay(false);
    // Mark as completed in local storage
    try {
      localStorage.setItem("sv_tour_completed", "true");
      
      const saved = localStorage.getItem("sv_completed_tours");
      let completed: Record<string, boolean> = {};
      if (saved) {
        try { completed = JSON.parse(saved); } catch {}
      }
      completed[pathname || ""] = true;
      localStorage.setItem("sv_completed_tours", JSON.stringify(completed));

      const isSmart = localStorage.getItem("sv_autopilot_tour_active") === "true";

      localStorage.removeItem("sv_auto_tour_active");
      localStorage.removeItem("sv_auto_tour_page_index");
      localStorage.removeItem("sv_autopilot_tour_active");
      localStorage.removeItem("sv_settings_tour_active");
      
      // Clean up mock data and backend offline keys so refresh or future calls fetch real backend
      localStorage.removeItem("sv_mock_clusters");
      localStorage.removeItem("sv_mock_incidents");
      localStorage.removeItem("sv_mock_channels");
      localStorage.removeItem("sv_mock_rules");
      localStorage.removeItem("sv_mock_resource_alerts");
      localStorage.removeItem("sv_mock_service_owners");
      localStorage.removeItem("sv_mock_preferences");
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

  // Keyboard controls for the tour
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Escape" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [active]);

  // Listen to start tour events
  useEffect(() => {
    const handleStartTour = () => {
      startTour();
    };
    const handleStartAutoTour = () => {
      if (typeof window !== "undefined") {
        localStorage.setItem("sv_auto_tour_active", "true");
        localStorage.setItem("sv_auto_tour_page_index", "0");
        const isSmart = localStorage.getItem("sv_autopilot_tour_active") === "true";
        setActive(true);
        setAutoPlay(isSmart);
        setStepIndex(0);
        setTimeLeft(stepDuration);
      }
    };
    window.addEventListener("sv_start_tour", handleStartTour);
    window.addEventListener("sv_start_auto_tour", handleStartAutoTour);
    return () => {
      window.removeEventListener("sv_start_tour", handleStartTour);
      window.removeEventListener("sv_start_auto_tour", handleStartAutoTour);
    };
  }, [stepDuration]);

  // Listen to pathname changes for auto-tour continuation
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("sv_start_live_tour_on_load") === "true") {
        localStorage.removeItem("sv_start_live_tour_on_load");
        startTour();
        return;
      }
      const isAuto = localStorage.getItem("sv_auto_tour_active") === "true";
      if (isAuto) {
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

  // Reset progress timer on step changes
  useEffect(() => {
    if (active) {
      setTimeLeft(stepDuration);
    }
  }, [stepIndex, pathname, active, stepDuration]);

  // Auto-play timer loop
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
    if (typeof window === "undefined") return;
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
        // 1. Clusters Page autopilot actions
        if (pathname === "/dashboard/clusters") {
          if (stepIndex === 1) {
            const addBtn = await waitForElement("#add-cluster-btn");
            if (addBtn) {
              addBtn.click();
              const nameInput = await waitForElement("input[placeholder='production-us-east']");
              if (nameInput) {
                simulateTyping(nameInput, "srevox-demo-gke");
                await delay(800);
                const submitBtn = await waitForButtonWithText("Add cluster");
                if (submitBtn) {
                  submitBtn.click();
                  const doneBtn = await waitForButtonWithText("Done");
                  if (doneBtn) {
                    doneBtn.click();
                  }
                }
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
              const nameInput = await waitForElement("input[placeholder='e.g. Engineering On-Call Alerts']");
              if (nameInput) {
                simulateTyping(nameInput, "slack-incident-alerts");
                await delay(800);
                const webhookTab = await waitForButtonWithText("webhook");
                if (webhookTab) {
                  webhookTab.click();
                  const urlInput = await waitForElement("input[placeholder='https://hooks.slack.com/services/...']");
                  if (urlInput) {
                    simulateTyping(urlInput, "https://hooks.slack.com/services/T00/B00/X00");
                    await delay(800);
                    const saveBtn = await waitForButtonWithText("Save Channel");
                    if (saveBtn) {
                      saveBtn.click();
                    }
                  }
                }
              }
            }
          }
        }
        
        // 3. Rules Page autopilot actions
        if (pathname === "/dashboard/rules") {
          if (stepIndex === 1) {
            const addBtn = await waitForElement("#add-rule-btn");
            if (addBtn) {
              addBtn.click();
              const nameInput = await waitForElement("input[placeholder='Production critical']");
              if (nameInput) {
                simulateTyping(nameInput, "OOMKilled Critical Alert");
                await delay(800);
                const clusterSelect = await waitForElement("select") as HTMLSelectElement;
                if (clusterSelect && clusterSelect.options.length > 0) {
                  clusterSelect.value = "mock-prod-cluster";
                  clusterSelect.dispatchEvent(new Event("change", { bubbles: true }));
                  await delay(800);
                }
                const saveBtn = await waitForButtonWithText("Create rule");
                if (saveBtn) {
                  saveBtn.click();
                }
              }
            }
          }
        }
  
        // 4. Infrastructure Page autopilot actions
        // if (pathname === "/dashboard/infrastructure") {
        //   if (stepIndex === 4) {
        //     const addBtn = await waitForElement("#infra-set-alert-btn");
        //     if (addBtn) {
        //       addBtn.click();
        //       const saveBtn = await waitForButtonWithText("Create alert");
        //       if (saveBtn) {
        //         saveBtn.click();
        //       }
        //     }
        //   }
        // }
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
          if (nextPage === "/cluster/infrastructure") {
            getTourClusterId().then(clusterId => {
              router.push(`/cluster/${clusterId}/infrastructure`);
            });
          } else {
            router.push(nextPage);
          }
        } else {
          endTour();
        }
      }
    }
  }, [active, autoPlay, timeLeft, stepIndex, steps.length, pathname, stepDuration, getTourSequence, router]);

  // Calculate coordinates and style for Guide Card
  const getCardStyle = (): React.CSSProperties => {
    if (targetRect) {
      const cardWidth = 360;
      const cardHeight = 240;
      const buffer = 16;
      let top = targetRect.bottom + buffer;
      let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;

      // Bound checking horizontally
      if (left < buffer) {
        left = buffer;
      } else if (left + cardWidth > window.innerWidth - buffer) {
        left = window.innerWidth - cardWidth - buffer;
      }

      // Check if there is enough height below the element
      const spaceBelow = window.innerHeight - targetRect.bottom;
      if (spaceBelow < cardHeight + buffer * 2) {
        // Place above target
        top = targetRect.top - cardHeight - buffer;
        if (top < buffer) {
          // If no space above either, fallback to centering in screen space
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

    // Default screen center fallback
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
  const isCentered = !targetRect;

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
                <span>Srevox Guide</span>
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
