"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  fullName: string;
  email: string | null;
  role: string;
  tenant?: {
    unit?: {
      unitNumber: string;
    } | null;
  } | null;
};

type CurrentUserResponse = {
  user?: CurrentUser | null;
  error?: string;
};

type AuthenticatedProfileHeaderProps = {
  portal: "admin" | "tenant";
};

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

export default function AuthenticatedProfileHeader({
  portal,
}: AuthenticatedProfileHeaderProps) {
  const [user, setUser] = useState<CurrentUser | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data =
        (await response.json()) as CurrentUserResponse;

      if (!cancelled) {
        setUser(data.user ?? null);
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return (
      <div className="text-right text-sm text-white/80">
        Loading profile...
      </div>
    );
  }

  const unitNumber = user.tenant?.unit?.unitNumber;

  return (
    <div className="text-right">
      <p className="font-semibold text-white">
        {user.fullName}
      </p>

      <p className="text-sm text-white/80">
        {user.email ?? "No email address"}
      </p>

      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
        {formatRole(user.role)}
        {portal === "tenant" && unitNumber
          ? ` · Unit ${unitNumber}`
          : ""}
      </p>
    </div>
  );
}
