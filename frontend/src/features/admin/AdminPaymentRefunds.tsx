"use client";

import { useCallback, useEffect, useState } from "react";
import { adminService } from "./admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type RefundItem = {
  id: string;
  amount: number | string;
  status: string;
  reason?: string | null;
  providerRefundId?: string | null;
  createdAt: string;
  paymentTransaction?: {
    provider?: string;
    currency?: string;
    razorpayPaymentId?: string | null;
    purchaseOrder?: {
      poNumber?: string;
      buyer?: { name?: string };
      supplier?: { name?: string };
    };
  };
};

const money = (amount: number | string, currency = "INR") => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount)); }
  catch { return String(amount); }
};

export function AdminPaymentRefunds() {
  const [items, setItems] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setError("");
      const result = await adminService.refunds();
      setItems(result?.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load refund requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useRealtimeSync({ topics: ["payment:refund_updated"], onSync: load, pollIntervalMs: 30000 });

  const process = async (item: RefundItem, decision: "APPROVE" | "REJECT") => {
    const note = (notes[item.id] || "").trim();
    if (decision === "REJECT" && note.length < 5) {
      setError("Enter a rejection note of at least 5 characters.");
      return;
    }
    const isTest = item.paymentTransaction?.provider === "MOCK_TEST";
    const message = decision === "APPROVE"
      ? isTest ? "Approve this simulated test refund? No money will be returned or moved." : "Approve this refund and send it to the payment provider?"
      : "Reject this refund request?";
    if (!window.confirm(message)) return;

    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      await adminService.processRefund(item.id, decision, note || undefined);
      setNotice(decision === "APPROVE" ? (isTest ? "Simulated test refund completed. No money was moved." : "Refund sent to the payment provider. Its provider status will update separately.") : "Refund request rejected.");
      setNotes(current => ({ ...current, [item.id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to process refund.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Refund Requests</h2>
        <p className="text-sm text-slate-500">Review refund requests. MOCK_TEST refunds are simulated; no real money is returned. External provider refunds are not enabled in the current test workflow.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {loading ? <p className="py-5 text-sm text-slate-500">Loading refund requests…</p> : items.length === 0 ? (
        <p className="py-5 text-sm text-slate-500">No refund requests.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map(item => (
            <article key={item.id} className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.paymentTransaction?.purchaseOrder?.poNumber || "Order"} · {item.paymentTransaction?.purchaseOrder?.buyer?.name || "Buyer"}</p>
                  <p className="mt-1 text-xs text-slate-500">Supplier: {item.paymentTransaction?.purchaseOrder?.supplier?.name || "—"}</p>
                  <p className={item.paymentTransaction?.provider === "MOCK_TEST" ? "mt-1 text-xs font-bold text-amber-700" : "mt-1 text-xs text-slate-500"}>{item.paymentTransaction?.provider === "MOCK_TEST" ? "MOCK_TEST · TEST SIMULATOR · NO REAL MONEY" : item.paymentTransaction?.provider || "PAYMENT PROVIDER"}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.reason || "No reason supplied"}</p>
                  <p className="mt-1 break-all text-xs text-slate-400">{item.providerRefundId || item.id} · {new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{money(item.amount, item.paymentTransaction?.currency || "INR")}</p>
                  <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status}</span>
                </div>
              </div>
              {item.status === "REQUESTED" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={notes[item.id] || ""}
                    onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))}
                    placeholder="Admin note (required to reject)"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
                  />
                  <div className="flex gap-2">
                    <button disabled={busy === item.id} onClick={() => void process(item, "APPROVE")} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{item.paymentTransaction?.provider === "MOCK_TEST" ? "Approve test refund" : "Approve provider refund"}</button>
                    <button disabled={busy === item.id} onClick={() => void process(item, "REJECT")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Reject</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
