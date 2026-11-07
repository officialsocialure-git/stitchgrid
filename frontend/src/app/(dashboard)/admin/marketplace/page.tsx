"use client";
import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
const fetchCatalog = (p: URLSearchParams) => { const next = new URLSearchParams(p); const category = next.get("status") || "ALL"; next.delete("status"); next.set("category", category); return adminService.marketplace(next); };
export default function MarketplacePage() {
    return <AdminResourcePage title="Marketplace" description="Review fabric, trims and product listings submitted by suppliers." fetcher={fetchCatalog} searchPlaceholder="Search products or suppliers…" statuses={[{ label: "Garment", value: "Garment (Apparel)" }, { label: "Fabric", value: "Fabric Mill" }, { label: "Trims & Accessories", value: "Trims & Accessories" }]} statusLabel="All Categories" columns={[
        { label: "Listing", render: r => <div><p className="font-semibold text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.description || "No description"}</p></div> },
        { label: "Supplier", render: r => r.supplierProfile?.organization?.name || "—" },
        { label: "Category", render: r => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{r.itemType}</span> },
        { label: "MOQ", render: r => r.moq ? Number(r.moq).toLocaleString() + " pcs" : "—" },
        { label: "Unit price", render: r => r.unitPrice ? new Intl.NumberFormat("en-IN", { style: "currency", currency: r.currency || "INR", maximumFractionDigits: 2 }).format(Number(r.unitPrice)) : "—" },
        { label: "Listing status", render: r => <Status value={r.moderationStatus} /> }
    ]} actions={(row, refresh) => <><button onClick={async () => { try { await adminService.moderateCatalog(row.id, "APPROVED"); refresh(); } catch (e) { window.alert(e instanceof Error ? e.message : "Could not approve listing."); } }} className="rounded-lg bg-[#D9F66A] px-3 py-2 text-xs font-bold">Approve</button><button onClick={async () => { const note = window.prompt("Reason for rejection (optional):") || ""; try { await adminService.moderateCatalog(row.id, "REJECTED", note); refresh(); } catch (e) { window.alert(e instanceof Error ? e.message : "Could not reject listing."); } }} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button></>} />;
} 
