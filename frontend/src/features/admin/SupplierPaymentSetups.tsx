"use client";

import { useCallback, useEffect, useState } from "react";
import { adminService } from "./admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export function SupplierPaymentSetups() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const result = await adminService.paymentSetups(); setItems(result?.items || []); }
    catch (e) { console.error("Unable to load supplier payment onboarding:", e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeSync({ topics: ["payment:setup_updated"], onSync: load, pollIntervalMs: 30000 });
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-bold text-slate-900">Supplier Payment Onboarding</h2><p className="text-sm text-slate-500">Masked bank details and provider onboarding status. Full account numbers are not stored in STITCHGRID.</p></div>
      {loading ? <p className="py-6 text-sm text-slate-500">Loading supplier setups…</p> : items.length === 0 ? <p className="py-6 text-sm text-slate-500">No supplier payment setup submissions yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Supplier</th><th className="p-3">Account holder</th><th className="p-3">Bank</th><th className="p-3">Account</th><th className="p-3">KYC</th><th className="p-3">Setup status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.id}><td className="p-3 font-semibold text-slate-800">{item.organization?.name || item.organizationId}</td><td className="p-3">{item.accountHolderName || "—"}</td><td className="p-3">{item.bankName || "—"}</td><td className="p-3">•••• {item.bankAccountLast4 || "—"}</td><td className="p-3">{item.kycStatus}</td><td className="p-3"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{item.status}</span></td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  );
}
