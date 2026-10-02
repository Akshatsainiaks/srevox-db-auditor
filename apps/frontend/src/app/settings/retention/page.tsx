"use client";

import React from "react";
import AuditRetention from "@/components/settings/AuditRetention";
import { getUser } from "@/lib/auth";

export default function RetentionSettingsPage() {
  const me = getUser();
  const isAdmin = me?.role === "admin";

  return <AuditRetention isAdmin={isAdmin} />;
}
