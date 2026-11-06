"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { marketplaceService } from "@/services/marketplace.service";

export default function AdminConsolePage() {
  const { user, membership } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listAdminOrganizations();
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Failed to load admin organizations:", err);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerify = async (orgId: string, status: "APPROVED" | "REJECTED") => {
    try {
      setActionLoading(orgId);
      await marketplaceService.updateVerificationStatus(orgId, status);
      setFeedback(`Organization status successfully updated to ${status}`);
      setTimeout(() => setFeedback(null), 3500);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update verification status");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingSuppliers = organizations.filter(
    (o) =>
      o.verificationStatus === "PENDING" &&
      o.members?.some((m: any) => m.role === "SUPPLIER")
  );

  const approvedSuppliers = organizations.filter(
    (o) =>
      o.verificationStatus === "APPROVED" &&
      o.members?.some((m: any) => m.role === "SUPPLIER")
  );

  const buyers = organizations.filter((o) =>
    o.members?.some((m: any) => m.role === "BUYER")
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-sans font-bold text-2xl text-on-surface">Platform Administration</h1>
            <Badge variant="primary" size="sm">Admin Role</Badge>
          </div>
          <p className="text-xs text-secondary mt-1">
            Review manufacturer verification requests, manage business compliance, and oversee marketplace state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon="refresh" onClick={loadData}>
            Refresh Data
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon="dashboard">
              Main Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
          <span className="text-[11px] font-mono uppercase text-secondary">Pending Verifications</span>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{pendingSuppliers.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
          <span className="text-[11px] font-mono uppercase text-secondary">Verified Suppliers</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{approvedSuppliers.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
          <span className="text-[11px] font-mono uppercase text-secondary">Registered Buyers</span>
          <p className="text-2xl font-bold font-mono text-primary mt-1">{buyers.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
          <span className="text-[11px] font-mono uppercase text-secondary">Total Organizations</span>
          <p className="text-2xl font-bold font-mono text-on-surface mt-1">{organizations.length}</p>
        </div>
      </div>

      {/* Section 1: Pending Supplier Verifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
            <span>Pending Manufacturer Verification Requests</span>
            {pendingSuppliers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-mono font-bold">
                {pendingSuppliers.length} action required
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-secondary">Loading verification queue...</div>
        ) : pendingSuppliers.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-center">
            <span className="material-symbols-outlined text-emerald-600 text-[32px] mb-1">verified</span>
            <p className="text-xs font-bold text-on-surface">Verification Queue Clear</p>
            <p className="text-[11px] text-secondary mt-0.5">All registered manufacturers have been reviewed and approved.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingSuppliers.map((org) => {
              const primaryUser = org.members?.[0]?.user;
              const profile = org.supplierProfile;
              return (
                <div
                  key={org.id}
                  className="p-5 rounded-2xl bg-surface-container-lowest border border-amber-200/80 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-on-surface">{org.name}</h3>
                        <p className="text-xs text-secondary">
                          Contact: <strong>{primaryUser?.fullName || "Representative"}</strong> • {primaryUser?.phone || primaryUser?.email}
                        </p>
                      </div>
                      <Badge variant="warning" size="sm">Verification Pending</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-surface-container-low p-3 rounded-xl border border-surface-container-high font-mono">
                      <div>
                        <span className="text-secondary block text-[10px]">GST / Tax ID</span>
                        <span className="font-bold text-on-surface">{org.taxId || "Not Provided"}</span>
                      </div>
                      <div>
                        <span className="text-secondary block text-[10px]">Location</span>
                        <span className="font-bold text-on-surface">{org.city || "India"}</span>
                      </div>
                      <div>
                        <span className="text-secondary block text-[10px]">Capacity</span>
                        <span className="font-bold text-on-surface">
                          {profile?.productionCapacity ? `${profile.productionCapacity.toLocaleString()} pcs/mo` : "Standard"}
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary block text-[10px]">Experience</span>
                        <span className="font-bold text-on-surface">
                          {profile?.yearsInBusiness ? `${profile.yearsInBusiness} yrs in business` : "Established"}
                        </span>
                      </div>
                    </div>

                    {profile?.description && (
                      <p className="text-xs text-secondary line-clamp-2">
                        {profile.description}
                      </p>
                    )}

                    {profile?.categories && profile.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {profile.categories.map((c: any) => (
                          <span
                            key={c.id || c.category}
                            className="px-2 py-0.5 rounded-full bg-[#ede8ff] text-[#4f14e2] text-[11px] font-semibold"
                          >
                            {c.category}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={actionLoading === org.id}
                      onClick={() => handleVerify(org.id, "REJECTED")}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="verified"
                      loading={actionLoading === org.id}
                      onClick={() => handleVerify(org.id, "APPROVED")}
                    >
                      Approve & List in Marketplace
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: All Network Organizations */}
      <div className="space-y-4 pt-4">
        <h2 className="text-base font-bold text-on-surface">All Network Organizations</h2>
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-secondary font-mono uppercase text-[11px] border-b border-surface-container-high">
                <tr>
                  <th className="p-3.5 pl-5">Organization</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Tax / GST ID</th>
                  <th className="p-3.5">Primary Contact</th>
                  <th className="p-3.5 pr-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {organizations.map((org) => {
                  const isVerified = org.verificationStatus === "APPROVED";
                  const primaryUser = org.members?.[0]?.user;
                  const roles = org.members?.map((m: any) => m.role).join(", ") || "MEMBER";

                  return (
                    <tr key={org.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3.5 pl-5 font-bold text-on-surface">{org.name}</td>
                      <td className="p-3.5 font-mono">{roles}</td>
                      <td className="p-3.5">{org.city || "India"}</td>
                      <td className="p-3.5 font-mono text-secondary">{org.taxId || "—"}</td>
                      <td className="p-3.5">
                        <span className="font-semibold block text-on-surface">{primaryUser?.fullName}</span>
                        <span className="text-[11px] font-mono text-secondary">{primaryUser?.phone || primaryUser?.email}</span>
                      </td>
                      <td className="p-3.5 pr-5">
                        <Badge variant={isVerified ? "success" : "warning"} size="sm">
                          {org.verificationStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

