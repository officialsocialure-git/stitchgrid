"use client";

import { useEffect, useState, useCallback } from "react";
import { User, Membership, Role } from "@/types";
import { authService } from "@/services/auth.service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from cache
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cachedUser = localStorage.getItem("sg_user");
      const cachedMembership = localStorage.getItem("sg_membership");
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch {
          // ignore
        }
      }
      if (cachedMembership) {
        try {
          setMembership(JSON.parse(cachedMembership));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sg_token") : null;
    if (!token) {
      setLoading(false);
      setUser(null);
      setMembership(null);
      return;
    }

    try {
      const data = await authService.me();
      const userData: User = {
        id: data.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        isActive: true,
        emailVerified: !!data.email,
        phoneVerified: !!data.phone,
      };
      setUser(userData);
      setMemberships(data.memberships || []);

      if (data.activeMembership) {
        setMembership(data.activeMembership);
        localStorage.setItem("sg_membership", JSON.stringify(data.activeMembership));
      } else if (data.memberships && data.memberships.length > 0) {
        setMembership(data.memberships[0]);
        localStorage.setItem("sg_membership", JSON.stringify(data.memberships[0]));
      }
    } catch {
      authService.logout();
      setUser(null);
      setMembership(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const switchWorkspace = async (role: Role, orgId?: string) => {
    const targetOrgId = orgId || membership?.organizationId || (memberships.length > 0 ? memberships[0].organizationId : "");
    if (!targetOrgId) return;

    try {
      setLoading(true);
      const res = await authService.switchContext(targetOrgId, role);
      setMembership(res.activeMembership);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sg_workspace_changed", { detail: res.activeMembership }));
      }
      await refreshUser();
    } catch (err) {
      console.error("Failed to switch workspace:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    membership,
    memberships,
    loading,
    isAuthenticated: !!user,
    refreshUser,
    switchWorkspace,
  };
}

