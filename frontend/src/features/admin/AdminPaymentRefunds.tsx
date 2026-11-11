"use client";

import { useCallback, useEffect, useState } from "react";
import { adminService } from "./admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export function AdminPaymentRefunds() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const result = await adminService.refunds(); setItems(result?.items || []); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load refund requests."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeSync({ topics: ["payment:refund_updated"], onSync: load, pollIntervalMs: 30000 });
  const process = async (id: string, decision: "APPROVE" | "REJECT") => {
    setBusy(id); setError("");
    try { await adminService.processRefund(id, decision); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to process refund."); }
    finally { setBusy(""); }
  };
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-bold text-slate-900">Refund Requests</h2><p className="text-sm text-slate-500">Review buyer requests. Approved refunds are sent to Razorpay for processing.</p></div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading ? <p className="py-5 text-sm text-slate-500">Loading refund requests…</p> : items.length === 0 ? <p className="py-5 text-sm text-slate-500">No refund requests.</p> : <div className="divide-y divide-slate-100">{items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="font-semibold text-slate-900">{item.paymentTransaction?.purchaseOrder?.poNumber || "Order"} · {item.paymentTransaction?.purchaseOrder?.buyer?.name || "Buyer"}</p><p className="mt-1 text-xs text-slate-500">{item.reason}</p><p className="mt-1 text-xs text-slate-500">{item.providerRefundId || item.id} · {item.status}</p></div><div className="flex items-center gap-2"><p className="font-bold text-slate-900">₹{Number(item.amount).toLocaleString("en-IN")}</p>{item.status === "REQUESTED" && <><button disabled={busy === item.id} onClick={() => process(item.id,"APPROVE")} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busy === item.id} onClick={() => process(item.id,"REJECT")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Reject</button></>}</div></div>)}</div>}
    </section>
  );
}
