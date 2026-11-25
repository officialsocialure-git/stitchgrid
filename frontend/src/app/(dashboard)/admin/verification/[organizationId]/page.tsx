"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, CheckCircle2, MapPin, ShieldCheck, FileText,
  Eye, Clock3, XCircle, X, LoaderCircle, Image as ImageIcon,
  History, UserRound, CalendarDays, ExternalLink, AlertTriangle
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { marketplaceService } from "@/services/marketplace.service";
import { Status } from "@/features/admin/AdminResourcePage";

type Decision = "APPROVED" | "REJECTED";

export default function VerificationReviewPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "activity">("overview");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      adminService.organization(params.organizationId),
      adminService.organizationActivity(params.organizationId).catch(() => [])
    ]).then(([organization, activity]) => {
      if (!mounted) return;
      setOrg(organization);
      setLogs(Array.isArray(activity)
        ? activity.filter((event: any) => event.entityId === params.organizationId || event.organizationId === params.organizationId)
        : []);
    }).catch((e) => {
      if (mounted) setError(e instanceof Error ? e.message : "Unable to load business profile.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [params.organizationId]);

  const contact = org?.members?.find((member: any) => member.isActive)?.user || org?.members?.[0]?.user;
  const certifications = org?.supplierProfile?.certifications || [];
  const businessMedia = org?.businessMedia || [];
  const roleLabels = useMemo(
    () => [...new Set((org?.members || []).filter((member: any) => member.role === "BUYER" || member.role === "SUPPLIER").map((member: any) => member.role))],
    [org]
  );

  const submitDecision = async (status: Decision, reason = "") => {
    setBusy(true);
    setError("");
    try {
      await marketplaceService.updateVerificationStatus(params.organizationId, status, reason);
      router.push("/admin/verification");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update verification.");
      setDecision(null);
    } finally {
      setBusy(false);
    }
  };

  const decideDesktop = async (status: Decision) => {
    let reason = "";
    if (status === "REJECTED") {
      const response = window.prompt("Reason for rejection (optional):");
      if (response === null) return;
      reason = response;
    }
    await submitDecision(status, reason);
  };

  if (loading) return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-[#5B13EC]"/>Loading business review…</div>;
  if (!org) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{error || "Business profile not found."}<Link href="/admin/verification" className="ml-2 font-semibold text-[#5B13EC]">Back to Verification</Link></div>;

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      {/* Existing desktop review layout is intentionally preserved. */}
      <div className="hidden md:block">
        <Link href="/admin/verification" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Back to Verification</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-extrabold sm:text-[28px]">Verification Review</h1><p className="mt-1 text-sm text-slate-500">Review the business profile before changing its verification status.</p></div>
          <Status value={org.verificationStatus}/>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100"><Building2 size={23}/></span><div><h2 className="font-bold">{org.name}</h2><p className="text-sm text-slate-500">{contact?.fullName || "Primary contact not available"} · {contact?.email || contact?.phone || "No contact"}</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-slate-400">Legal name</p><p className="mt-1 text-sm font-semibold">{org.legalName || "—"}</p></div>
            <div><p className="text-xs text-slate-400">Business type</p><p className="mt-1 text-sm font-semibold">{org.businessType || roleLabels.join(", ") || "—"}</p></div>
            <div><p className="text-xs text-slate-400">GST / Tax ID</p><p className="mt-1 text-sm font-semibold">{org.taxId || "Not provided"}</p></div>
            <div><p className="text-xs text-slate-400">Location</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold"><MapPin size={14}/>{[org.city, org.country].filter(Boolean).join(", ") || "Not provided"}</p></div>
            <div><p className="text-xs text-slate-400">Production capacity</p><p className="mt-1 text-sm font-semibold">{org.supplierProfile?.productionCapacity ? Number(org.supplierProfile.productionCapacity).toLocaleString() + " units/month" : "—"}</p></div>
            <div><p className="text-xs text-slate-400">Years in business</p><p className="mt-1 text-sm font-semibold">{org.supplierProfile?.yearsInBusiness ?? "—"}</p></div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Business address</p><p className="mt-1 text-sm text-slate-700">{org.address || "No address submitted"}</p><p className="mt-2 text-xs text-slate-400">Country</p><p className="mt-1 text-sm font-semibold">{org.country || "Not provided"}</p></div>
          <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Company profile details</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{org.supplierProfile?.description || "No factory bio or capability description submitted."}</p></div>
          <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Supplier payment setup</p><div className="mt-2 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Setup status</p><p className="text-sm font-semibold">{org.supplierPaymentProfile?.status || "NOT_STARTED"}</p></div><div><p className="text-xs text-slate-400">KYC status</p><p className="text-sm font-semibold">{org.supplierPaymentProfile?.kycStatus || "NOT_STARTED"}</p></div><div><p className="text-xs text-slate-400">Settlement status</p><p className="text-sm font-semibold">{org.supplierPaymentProfile?.settlementStatus || "NOT_STARTED"}</p></div></div>{org.supplierPaymentProfile?.rejectionReason && <p className="mt-2 text-sm text-rose-700">Reason: {org.supplierPaymentProfile.rejectionReason}</p>}</div>
          <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Supplier categories</p><div className="mt-2 flex flex-wrap gap-2">{org.supplierProfile?.categories?.length ? org.supplierProfile.categories.map((category: any) => <span key={category.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{category.category}</span>) : <span className="text-sm text-slate-500">No categories submitted</span>}</div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Category capabilities</p><div className="mt-2 flex flex-wrap gap-2">{org.supplierProfile?.capabilities?.length ? org.supplierProfile.capabilities.map((capability: any) => <span key={capability.id} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{capability.value}</span>) : <span className="text-sm text-slate-500">No capabilities submitted</span>}</div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Serviceable regions</p><p className="mt-1 text-sm text-slate-700">{org.serviceableRegions || "Not provided"}</p></div>
          <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Catalogue listings</p><div className="mt-2 space-y-2">{org.supplierProfile?.catalogItems?.length ? org.supplierProfile.catalogItems.map((item: any) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-semibold">{item.name}</span><span className="text-slate-500">{item.itemType}</span></div>) : <span className="text-sm text-slate-500">No catalogue listings yet</span>}</div></div>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">{org.verificationStatus === "PENDING" ? <><button disabled={busy} onClick={() => decideDesktop("REJECTED")} className="rounded-xl border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">Reject</button><button disabled={busy} onClick={() => decideDesktop("APPROVED")} className="inline-flex items-center gap-2 rounded-xl bg-[#D9F66A] px-5 py-2.5 text-sm font-bold disabled:opacity-50"><CheckCircle2 size={17}/>{busy ? "Saving…" : "Approve business"}</button></> : <span className="inline-flex items-center gap-2 text-sm text-slate-500"><ShieldCheck size={17}/> Verification is already reviewed.</span>}</div>
        </div>
      </div>

      {/* Mobile verification detail: Overview / Documents / Activity tabs. */}
      <div className="space-y-4 pb-24 md:hidden">
        <div className="flex items-center gap-3">
          <Link href="/admin/verification" aria-label="Back to verification list" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E2E6ED] bg-white text-[#334155]"><ArrowLeft size={18}/></Link>
          <div className="min-w-0"><h1 className="text-lg font-extrabold text-[#182332]">Verification Details</h1><p className="text-[11px] text-slate-500">Review business information and documents</p></div>
        </div>

        <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F0E7FF] text-lg font-extrabold text-[#5B13EC]">{(org.name || "B").slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-extrabold text-[#182332]">{org.name}</p><p className="mt-0.5 text-xs text-slate-500">{roleLabels.join(" · ") || "Business"} · {org.businessType || "Business profile"}</p></div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${org.verificationStatus === "APPROVED" ? "bg-emerald-50 text-emerald-700" : org.verificationStatus === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{org.verificationStatus === "APPROVED" ? "Approved" : org.verificationStatus === "REJECTED" ? "Rejected" : "Pending"}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-[#E2E6ED] bg-white p-1">
          {[{key:"overview",label:"Overview",icon:Building2},{key:"documents",label:"Documents",icon:FileText},{key:"activity",label:"Activity",icon:History}].map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key as "overview"|"documents"|"activity")} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold ${activeTab === tab.key ? "bg-[#F0E7FF] text-[#5B13EC]" : "text-slate-500"}`}><tab.icon size={14}/>{tab.label}</button>)}
        </div>

        {activeTab === "overview" && (
          <div className="overflow-hidden rounded-2xl border border-[#E2E6ED] bg-white">
            {[
              {label:"Organization",value:org.legalName || org.name,icon:Building2},
              {label:"Business Type",value:org.businessType || roleLabels.join(" / ") || "Not provided",icon:ShieldCheck},
              {label:"GST / Tax ID",value:org.taxId || "Not provided",icon:FileText},
              {label:"Location",value:[org.city, org.country].filter(Boolean).join(", ") || "Not provided",icon:MapPin},
              {label:"Primary Contact",value:contact?.fullName || "Not available",icon:UserRound},
              {label:"Contact Email",value:contact?.email || "Not provided",icon:UserRound},
              {label:"Contact Phone",value:contact?.phone || "Not provided",icon:UserRound},
              {label:"Submitted On",value:new Date(org.createdAt).toLocaleString(),icon:CalendarDays},
              {label:"Production Capacity",value:org.supplierProfile?.productionCapacity ? Number(org.supplierProfile.productionCapacity).toLocaleString() + " units/month" : "Not provided",icon:Building2},
              {label:"Years in Business",value:org.supplierProfile?.yearsInBusiness ?? "Not provided",icon:Clock3},
            ].map((row) => <div key={row.label} className="flex items-start gap-3 border-b border-[#EEF0F4] px-4 py-3 last:border-b-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F6F3FC] text-[#48586C]"><row.icon size={17}/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-slate-500">{row.label}</p><p className="mt-0.5 break-words text-xs font-semibold text-[#182332]">{row.value}</p></div></div>)}
            <div className="border-t border-[#EEF0F4] px-4 py-3"><p className="text-[10px] font-semibold text-slate-500">Business Address</p><p className="mt-1 whitespace-pre-wrap text-xs font-semibold text-[#182332]">{org.address || "No address submitted"}</p></div>
            <div className="border-t border-[#EEF0F4] px-4 py-3"><p className="text-[10px] font-semibold text-slate-500">Company Profile</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#334155]">{org.supplierProfile?.description || "No company description submitted."}</p></div>
            <div className="border-t border-[#EEF0F4] px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-500">Supplier Payment Setup</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div><p className="text-[9px] text-slate-400">Setup</p><p className="mt-0.5 break-words text-[10px] font-bold text-[#334155]">{org.supplierPaymentProfile?.status || "NOT_STARTED"}</p></div>
                <div><p className="text-[9px] text-slate-400">KYC</p><p className="mt-0.5 break-words text-[10px] font-bold text-[#334155]">{org.supplierPaymentProfile?.kycStatus || "NOT_STARTED"}</p></div>
                <div><p className="text-[9px] text-slate-400">Settlement</p><p className="mt-0.5 break-words text-[10px] font-bold text-[#334155]">{org.supplierPaymentProfile?.settlementStatus || "NOT_STARTED"}</p></div>
              </div>
              {org.supplierPaymentProfile?.rejectionReason && <p className="mt-2 text-[11px] text-rose-700">Reason: {org.supplierPaymentProfile.rejectionReason}</p>}
            </div>
            <div className="border-t border-[#EEF0F4] px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-500">Supplier Categories</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{org.supplierProfile?.categories?.length ? org.supplierProfile.categories.map((category: any) => <span key={category.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{category.category}</span>) : <span className="text-xs text-slate-500">No categories submitted</span>}</div>
              <p className="mt-3 text-[10px] font-semibold text-slate-500">Capabilities</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{org.supplierProfile?.capabilities?.length ? org.supplierProfile.capabilities.map((capability: any) => <span key={capability.id} className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{capability.value}</span>) : <span className="text-xs text-slate-500">No capabilities submitted</span>}</div>
              <p className="mt-3 text-[10px] font-semibold text-slate-500">Serviceable Regions</p><p className="mt-1 text-xs text-[#334155]">{org.serviceableRegions || "Not provided"}</p>
            </div>
            <div className="border-t border-[#EEF0F4] px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-500">Catalogue Listings</p>
              <div className="mt-2 space-y-2">{org.supplierProfile?.catalogItems?.length ? org.supplierProfile.catalogItems.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5"><span className="min-w-0 break-words text-xs font-semibold text-[#182332]">{item.name}</span><span className="shrink-0 text-[10px] text-slate-500">{item.itemType}</span></div>) : <span className="text-xs text-slate-500">No catalogue listings yet</span>}</div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[#182332]">Certifications</h2><span className="text-[11px] text-slate-400">{certifications.length} records</span></div>
              {certifications.length ? <div className="space-y-2">{certifications.map((cert: any) => <div key={cert.id} className="flex items-center gap-3 rounded-xl border border-[#EEF0F4] p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><FileText size={19}/></span><div className="min-w-0 flex-1"><p className="break-words text-xs font-bold text-[#182332]">{cert.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{cert.issuer || cert.category || "Certification"}{cert.certificateNumber ? ` · ${cert.certificateNumber}` : ""}</p>{cert.expiresAt && <p className="mt-1 text-[10px] text-slate-400">Expires {new Date(cert.expiresAt).toLocaleDateString()}</p>}</div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${cert.status === "VERIFIED" ? "bg-emerald-50 text-emerald-700" : cert.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{cert.status || "PENDING"}</span>{cert.documentUrl && <a href={cert.documentUrl} target="_blank" rel="noreferrer" aria-label={`Preview ${cert.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E2E6ED] text-[#48586C]"><Eye size={16}/></a>}</div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No certifications have been submitted for this business.</p>}
            </div>
            <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[#182332]">Business Media</h2><span className="text-[11px] text-slate-400">{businessMedia.length} files</span></div>
              {businessMedia.length ? <div className="space-y-2">{businessMedia.map((media: any) => <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-[#EEF0F4] p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-50 text-[#5B13EC]"><ImageIcon size={19}/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[#182332]">{media.fileName || media.mediaType?.replaceAll("_", " ") || "Business file"}</span><span className="mt-0.5 block text-[10px] text-slate-500">{media.mediaType?.replaceAll("_", " ") || "Business media"}</span></span><ExternalLink size={15} className="text-slate-400"/></a>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No uploaded business media is linked to this profile.</p>}
            </div>
            <p className="px-1 text-[10px] leading-4 text-slate-400">Only certifications and business media currently stored against this organization are shown here. No separate GST or identity-document upload record is available in the current data model.</p>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4">
            <h2 className="mb-4 text-sm font-extrabold text-[#182332]">Verification Activity</h2>
            {logs.length ? <div className="space-y-0">{logs.map((event: any, index: number) => <div key={event.id} className="relative flex gap-3"><div className="relative flex w-8 shrink-0 justify-center"><span className="relative z-10 mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-[#F0E7FF] text-[#5B13EC]"><History size={15}/></span>{index < logs.length - 1 && <span className="absolute bottom-0 top-8 w-px bg-[#DCD2F5]"/>}</div><div className="min-w-0 flex-1 border-b border-[#EEF0F4] pb-5 pt-1 last:border-b-0"><p className="break-words text-xs font-bold text-[#182332]">{String(event.action || "Activity").replaceAll("_", " ")}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(event.createdAt).toLocaleString()}{event.user?.fullName ? ` · by ${event.user.fullName}` : ""}</p>{event.metadata?.status && <p className="mt-1 text-[11px] text-slate-600">Status: {event.metadata.status}</p>}{event.metadata?.note && <p className="mt-1 text-[11px] text-slate-600">Note: {event.metadata.note}</p>}</div></div>)}</div> : <div className="py-8 text-center"><Clock3 size={28} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-semibold text-[#334155]">No recorded activity yet</p><p className="mt-1 text-[10px] text-slate-500">Organization audit events will appear here when available.</p></div>}
          </div>
        )}

        {error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        {org.verificationStatus === "PENDING" ? (
          <div className="fixed inset-x-0 bottom-[76px] z-40 mx-auto grid max-w-[720px] grid-cols-2 gap-2 border-t border-[#E2E6ED] bg-white/95 px-4 py-3 backdrop-blur-lg md:hidden">
            <button disabled={busy} onClick={() => { setDecision("REJECTED"); setNote(""); setError(""); }} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-bold text-rose-600 disabled:opacity-50"><XCircle size={17}/>Reject</button>
            <button disabled={busy} onClick={() => { setDecision("APPROVED"); setNote(""); setError(""); }} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={17}/>Approve</button>
          </div>
        ) : <div className="rounded-xl bg-emerald-50 p-3 text-center text-xs font-semibold text-emerald-700"><ShieldCheck size={15} className="mr-1 inline"/>This business has already been reviewed.</div>}
      </div>

      {decision && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] md:items-center md:p-4" onClick={() => !busy && setDecision(null)}>
          <section role="alertdialog" aria-modal="true" aria-label={decision === "APPROVED" ? "Approve business" : "Reject business"} className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full ${decision === "APPROVED" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{decision === "APPROVED" ? <ShieldCheck size={28}/> : <AlertTriangle size={28}/>}</div>
            <h2 className="text-center text-lg font-extrabold text-[#182332]">{decision === "APPROVED" ? "Approve Business?" : "Reject Application?"}</h2>
            <p className="mt-2 text-center text-xs leading-5 text-slate-500">{decision === "APPROVED" ? "This will mark the organization as verified and update its supplier verification status." : "This will mark the organization as rejected. Add a reason so the decision is clear in the audit record."}</p>
            {decision === "REJECTED" && <label className="mt-4 block text-xs font-bold text-[#334155]">Rejection reason (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Explain why this application is being rejected…" className="mt-1.5 w-full rounded-xl border border-[#E2E6ED] p-3 text-sm font-normal outline-none focus:border-[#5B13EC]"/></label>}
            {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => setDecision(null)} className="h-11 rounded-xl border border-[#E2E6ED] text-sm font-bold text-[#334155]">Cancel</button><button disabled={busy} onClick={() => submitDecision(decision, note)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 ${decision === "APPROVED" ? "bg-[#5B13EC]" : "bg-rose-600"}`}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : decision === "APPROVED" ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}{busy ? "Saving…" : decision === "APPROVED" ? "Approve Business" : "Confirm Rejection"}</button></div>
          </section>
        </div>
      )}
    </section>
  );
}
