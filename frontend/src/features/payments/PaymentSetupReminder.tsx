"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { paymentService } from "@/features/payments/payment.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const TOPICS = ["payment:setup_updated", "payment:updated"];

export function PaymentSetupReminder({ placement = "dashboard" }: { placement?: "dashboard" | "orders" }) {
  const { membership } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (membership?.role !== "SUPPLIER") { setLoading(false); return; }
    try {
      const data = await paymentService.dashboard();
      setStatus(data?.supplierSetup?.status || "NOT_STARTED");
    } catch {
      setStatus(null);
    } finally { setLoading(false); }
  }, [membership?.role]);
  useEffect(() => { load(); }, [load]);
  useRealtimeSync({ topics: TOPICS, onSync: load, pollIntervalMs: 30000, enabled: membership?.role === "SUPPLIER" });
  if (membership?.role !== "SUPPLIER" || loading || status === "VERIFIED" || status === null) return null;

  const dashboardCard = placement === "dashboard";
  return (
    <section className={dashboardCard ? "rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5" : "rounded-xl border border-amber-200 bg-amber-50 p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{dashboardCard ? "Bank & Payment Setup" : "Action Required"}</p>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{dashboardCard ? "Complete your payment details to receive settlements for your orders." : "Your payment setup is incomplete. Complete bank verification before supplier settlements can be enabled."}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Action Required" : "Incomplete"}</span>
      </div>
      {dashboardCard && <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600"><span>Setup progress</span><span>{status === "PENDING" ? "1/3" : "0/3"}</span></div>
        <div className="mt-2 grid grid-cols-3 gap-2">{["Bank Details", "KYC", "Verification"].map((step, index) => <div key={step} className="rounded-lg border border-amber-200 bg-white px-3 py-2"><p className="text-xs font-semibold text-slate-800">{step}</p><p className="mt-1 text-[10px] text-slate-500">{index === 0 && status === "PENDING" ? "Submitted" : index === 1 && status === "PENDING" ? "In progress" : "Required"}</p></div>)}</div>
      </div>}
      <Link href="/payments" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#5B13EC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4d0ecf]">{dashboardCard ? "Complete Payment Setup" : "Complete Setup"}</Link>
    </section>
  );
}
