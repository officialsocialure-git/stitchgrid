"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { adminService } from "./admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Setup = {
  id: string;
  organizationId: string;
  status: string;
  kycStatus: string;
  settlementStatus: string;
  accountHolderName?: string | null;
  bankName?: string | null;
  bankAccountLast4?: string | null;
  ifscMasked?: string | null;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  organization?: { id: string; name: string; legalName?: string | null; country?: string | null };
};

const statusClass = (status: string) => {
  if (status === "VERIFIED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-800";
};

export function SupplierPaymentSetups() {
  const [items, setItems] = useState<Setup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setError("");
      const result = await adminService.paymentSetups();
      setItems(result?.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load supplier payment setups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync({ topics: ["payment:setup_updated"], onSync: load, pollIntervalMs: 30000 });

  const review = async (item: Setup, decision: "APPROVE" | "REJECT") => {
    const reason = (reasons[item.id] || "").trim();
    if (decision === "REJECT" && !reason) {
      setError("Please enter a reason before rejecting this setup.");
      return;
    }
    if (decision === "APPROVE" && !window.confirm("Approve this supplier payment setup after reviewing the submitted details?")) return;
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      await adminService.reviewPaymentSetup(item.id, decision, reason || undefined);
      setNotice(decision === "APPROVE" ? "Supplier payment setup marked as reviewed." : "Supplier payment setup rejected.");
      setReasons(current => ({ ...current, [item.id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update supplier payment setup.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Supplier Payment Onboarding</h2>
          <p className="mt-1 text-sm text-slate-500">Review submitted masked bank details. STITCHGRID does not store full account numbers here.</p>
        </div>
        <button onClick={load} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      {loading ? <p className="py-6 text-sm text-slate-500">Loading supplier setups…</p> : items.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">No supplier payment setup submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.organization?.name || item.organizationId}</h3>
                  {item.organization?.legalName && <p className="text-xs text-slate-500">{item.organization.legalName}</p>}
                  <p className="mt-1 text-xs text-slate-500">Submitted {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status}</span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><p className="text-xs text-slate-500">Account holder</p><p className="mt-1 font-semibold text-slate-800">{item.accountHolderName || "—"}</p></div>
                <div><p className="text-xs text-slate-500">Bank</p><p className="mt-1 font-semibold text-slate-800">{item.bankName || "—"}</p></div>
                <div><p className="text-xs text-slate-500">Account ending</p><p className="mt-1 font-semibold text-slate-800">•••• {item.bankAccountLast4 || "—"}</p></div>
                <div><p className="text-xs text-slate-500">IFSC (masked)</p><p className="mt-1 font-semibold text-slate-800">{item.ifscMasked || "—"}</p></div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${statusClass(item.kycStatus)}`}>KYC: {item.kycStatus}</span>
                <span className={`rounded-full px-2.5 py-1 font-semibold ${statusClass(item.settlementStatus)}`}>Settlement: {item.settlementStatus}</span>
              </div>

              {item.rejectionReason && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">Previous review note: {item.rejectionReason}</p>}

              {item.status !== "VERIFIED" && (
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                  <input
                    value={reasons[item.id] || ""}
                    onChange={e => setReasons(current => ({ ...current, [item.id]: e.target.value }))}
                    placeholder="Rejection reason (required only to reject)"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
                  />
                  <div className="flex gap-2">
                    <button disabled={busy === item.id} onClick={() => review(item, "APPROVE")} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
                      <CheckCircle2 size={14} /> Approve review
                    </button>
                    <button disabled={busy === item.id} onClick={() => review(item, "REJECT")} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:opacity-50">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
              {item.status === "VERIFIED" && item.verifiedAt && <p className="mt-3 text-xs text-emerald-700">Reviewed on {new Date(item.verifiedAt).toLocaleString()}</p>}
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">Approval here records an Admin review of the submitted details only. It does not confirm Razorpay Route onboarding or trigger a bank payout.</p>
    </section>
  );
}
