"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { paymentService } from "@/features/payments/payment.service";
import { marketplaceService } from "@/services/marketplace.service";
import { API_BASE_URL } from "@/constants";

const PAYMENT_TOPICS = ["payment:created", "payment:updated", "payment:setup_updated", "order:updated"];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => { open: () => void; on: (event: string, callback: (response: any) => void) => void };
  }
}

function money(value: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function statusTone(status: string) {
  if (["PAID", "APPROVED", "RELEASED", "VERIFIED", "COMPLETED"].includes(status)) return "success";
  if (["FAILED", "REJECTED", "DISPUTED"].includes(status)) return "error";
  return "warning";
}

export default function PaymentsPage() {
  const { membership } = useAuth();
  const role = membership?.role || "BUYER";
  const isSupplier = role === "SUPPLIER";
  const isBuyer = role === "BUYER";
  const resolveProofUrl = (url: string) => url?.startsWith("/uploads/") ? API_BASE_URL.replace(/\/api\/?$/, "") + url : url;
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [setup, setSetup] = useState({ accountHolderName: "", bankName: "", bankAccountLast4: "", ifscMasked: "" });
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofNotes, setProofNotes] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setError("");
      const result = await paymentService.dashboard();
      setDashboard(result);
      const p = result?.supplierSetup;
      if (p) setSetup({
        accountHolderName: p.accountHolderName || "",
        bankName: p.bankName || "",
        bankAccountLast4: p.bankAccountLast4 || "",
        ifscMasked: p.ifscMasked || ""
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load payment information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync({ topics: PAYMENT_TOPICS, onSync: load, pollIntervalMs: 30000 });

  const startCheckout = async (milestoneId: string) => {
    setBusy(milestoneId);
    setError("");
    try {
      const checkout = await paymentService.createCheckout(milestoneId);
      if (!checkout.keyId) throw new Error("Razorpay is not configured yet. Please contact the STITCHGRID administrator.");
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Unable to load Razorpay Checkout."));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
      const checkoutInstance = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        order_id: checkout.razorpayOrderId,
        handler: async (response: any) => {
          try {
            await paymentService.verify(response);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Payment verification is pending. Please wait for confirmation.");
          } finally { setBusy(""); }
        },
        modal: { ondismiss: () => setBusy("") },
        theme: { color: "#5B13EC" }
      });
      checkoutInstance.on("payment.failed", (response: any) => {
        setError(response?.error?.description || "Payment failed. You can retry this milestone.");
        setBusy("");
        load();
      });
      checkoutInstance.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start payment.");
      setBusy("");
    }
  };

  const initializePlan = async (orderId: string) => {
    setBusy(orderId);
    try { await paymentService.ensurePlan(orderId); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to initialize milestone plan."); }
    finally { setBusy(""); }
  };

  const saveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("setup");
    setError("");
    try { await paymentService.updateSupplierSetup(setup); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save payment details."); }
    finally { setBusy(""); }
  };

  const uploadMilestoneProof = async (milestoneId: string, file?: File) => {
    if (!file) return;
    setBusy(`upload-${milestoneId}`);
    setError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Unable to read selected file."));
        reader.readAsDataURL(file);
      });
      const uploaded = await marketplaceService.uploadFile(file.name, dataUrl, "Milestone Proof");
      setProofUrls(s => ({ ...s, [milestoneId]: uploaded.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload milestone proof.");
    } finally { setBusy(""); }
  };

  const submitProof = async (milestoneId: string) => {
    setBusy(milestoneId);
    try { await paymentService.submitProof(milestoneId, proofUrls[milestoneId] || "", proofNotes[milestoneId]); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to submit milestone proof."); }
    finally { setBusy(""); }
  };

  const reviewProof = async (milestoneId: string, decision: "APPROVE" | "REJECT") => {
    setBusy(milestoneId);
    try { await paymentService.reviewProof(milestoneId, decision, rejectReasons[milestoneId]); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to review milestone proof."); }
    finally { setBusy(""); }
  };

  const requestRefund = async (transactionId: string) => {
    setBusy(`refund-${transactionId}`);
    setError("");
    try { await paymentService.requestRefund(transactionId, refundReasons[transactionId] || "Refund requested by buyer"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to submit refund request."); }
    finally { setBusy(""); }
  };

  if (loading) return <div className="mx-auto max-w-7xl p-8 text-sm text-slate-500">Loading Payments & Earnings…</div>;

  const profile = dashboard?.supplierSetup || {};
  const setupComplete = profile.status === "VERIFIED";
  const allOrders = dashboard?.orders || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">{isSupplier ? "Payments & Earnings" : "Payments"}</h1>
            <p className="mt-1 text-sm text-slate-500">{isSupplier ? "Manage payment onboarding, milestone earnings and settlement activity." : "Pay agreed order milestones securely and track every transaction."}</p>
          </div>
          <Badge variant="primary">{dashboard?.checkoutConfigured ? "Razorpay Connected" : "Gateway Setup Pending"}</Badge>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {isSupplier && (
        <>
          {!setupComplete && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-bold text-slate-900">Bank & Payment Setup</h2><p className="mt-1 text-sm text-slate-600">Complete the setup steps before supplier settlements can be enabled.</p></div>
                <Badge variant="warning">{profile.status === "PENDING" ? "Verification Pending" : profile.status === "REJECTED" ? "Action Required" : "Incomplete"}</Badge>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                {["Bank Details", "KYC", "Verification"].map((step, index) => <div key={step} className="rounded-xl border border-amber-200 bg-white p-3"><p className="text-xs text-slate-500">STEP {index + 1}</p><p className="mt-1 font-semibold text-slate-800">{step}</p><p className="mt-1 text-xs text-amber-700">{index === 0 && profile.accountHolderName ? "Details submitted" : index === 1 && profile.kycStatus === "VERIFIED" ? "Verified" : index === 2 && profile.status === "VERIFIED" ? "Verified" : "Required"}</p></div>)}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Bank & Payment Details</h2><p className="text-sm text-slate-500">Payment details are collected after login, not during registration.</p></div><Badge variant={statusTone(profile.status || "NOT_STARTED") as any}>{profile.status || "NOT STARTED"}</Badge></div>
            <form onSubmit={saveSetup} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Account holder name<input required value={setup.accountHolderName} onChange={e => setSetup(s => ({...s, accountHolderName:e.target.value}))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-violet-600"/></label>
              <label className="text-sm font-medium text-slate-700">Bank name<input required value={setup.bankName} onChange={e => setSetup(s => ({...s, bankName:e.target.value}))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-violet-600"/></label>
              <label className="text-sm font-medium text-slate-700">Bank account last 4 digits<input required maxLength={4} pattern="\\d{4}" value={setup.bankAccountLast4} onChange={e => setSetup(s => ({...s, bankAccountLast4:e.target.value.replace(/\\D/g,"").slice(0,4)}))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-violet-600"/></label>
              <label className="text-sm font-medium text-slate-700">IFSC (masked)<input required value={setup.ifscMasked} onChange={e => setSetup(s => ({...s, ifscMasked:e.target.value.toUpperCase()}))} placeholder="SBIN****123" className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-violet-600"/></label>
              <div className="md:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">This form stores only masked account information. Full bank details and KYC must be completed through an approved Razorpay Route onboarding flow before payouts can be activated. STITCHGRID does not store full bank account numbers.</div>
              <div className="md:col-span-2"><Button type="submit" loading={busy === "setup"}>Save Payment Details</Button></div>
            </form>
          </section>
        </>
      )}

      <section className="space-y-4">
        <div><h2 className="text-lg font-bold text-slate-900">{isSupplier ? "Milestone Earnings" : "Order Milestone Payments"}</h2><p className="text-sm text-slate-500">Payment plans are linked to each purchase order.</p></div>
        {allOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No purchase orders found yet.</div> : allOrders.map((order: any) => (
          <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div><p className="font-bold text-slate-900">{order.poNumber}</p><p className="mt-1 text-xs text-slate-500">{isSupplier ? `Buyer: ${order.buyer?.name || "Buyer"}` : `Supplier: ${order.supplier?.name || "Supplier"}`}</p></div>
              <div className="text-right"><p className="text-xs text-slate-500">Order value</p><p className="text-lg font-extrabold text-slate-900">{money(order.totalAmount, order.currency)}</p></div>
            </div>
            {!order.paymentPlan ? <div className="p-5 text-sm text-slate-600">{isBuyer ? <><p>Milestone payment schedule is not initialized for this existing order.</p><Button className="mt-3" loading={busy === order.id} onClick={() => initializePlan(order.id)}>Set Up Milestone Payments</Button></> : "Waiting for the buyer to initialize the milestone payment schedule."}</div> : (
              <div className="divide-y divide-slate-100">
                {order.paymentPlan.milestones.map((m: any) => {
                  const latestPayment = (order.paymentTransactions || []).find((t: any) => t.paymentMilestoneId === m.id);
                  return <div key={m.id} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><p className="font-semibold text-slate-900">{m.sequence}. {m.title}</p><p className="mt-1 text-xs text-slate-500">{Number(m.percentage)}% of order value</p></div>
                      <div className="text-right"><p className="font-bold text-slate-900">{money(m.amount, order.currency)}</p><Badge variant={statusTone(m.status) as any}>{m.status.replaceAll("_"," ")}</Badge></div>
                    </div>
                    {latestPayment?.razorpayPaymentId && <p className="text-xs text-slate-500">Transaction: {latestPayment.razorpayPaymentId}</p>}
                    {isBuyer && !["PENDING_ACCEPTANCE","PO_CREATED","CANCELLED"].includes(order.status) && ["DUE","APPROVED","FAILED","PAYMENT_PENDING"].includes(m.status) && <Button disabled={!dashboard?.checkoutConfigured} loading={busy === m.id} onClick={() => startCheckout(m.id)}>{!dashboard?.checkoutConfigured ? "Gateway Setup Pending" : m.status === "PAYMENT_PENDING" ? "Continue Payment" : "Pay Now"}</Button>}
                    {isSupplier && m.sequence > 1 && (m.status === "REJECTED" || m.status === "PROOF_SUBMITTED" || (m.status === "UPCOMING" && order.paymentPlan.milestones.find((previous: any) => previous.sequence === m.sequence - 1)?.status === "PAID")) && <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <label className="flex h-10 items-center rounded-lg border border-slate-300 px-3 text-xs text-slate-600">Upload proof<input type="file" accept="image/*,.pdf" className="ml-2 min-w-0 text-xs" onChange={e => uploadMilestoneProof(m.id, e.target.files?.[0])}/></label>
                      <input value={proofNotes[m.id] || ""} onChange={e => setProofNotes(s => ({...s,[m.id]:e.target.value}))} placeholder="Completion note" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
                      <Button loading={busy === m.id} disabled={!proofUrls[m.id]} onClick={() => submitProof(m.id)}>Submit Proof</Button>
                    </div>}
                    {isBuyer && m.status === "PROOF_SUBMITTED" && <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                      <a href={resolveProofUrl(m.proofUrl)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-violet-700 underline">View supplier proof</a>
                      {m.completionNote && <p className="text-sm text-slate-600">{m.completionNote}</p>}
                      <input value={rejectReasons[m.id] || ""} onChange={e => setRejectReasons(s => ({...s,[m.id]:e.target.value}))} placeholder="Reason (required if rejecting)" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"/>
                      <div className="flex flex-wrap gap-2"><Button loading={busy === m.id} onClick={() => reviewProof(m.id,"APPROVE")}>Approve Milestone</Button><Button variant="outline" loading={busy === m.id} onClick={() => reviewProof(m.id,"REJECT")}>Reject with Reason</Button></div>
                    </div>}
                    {m.status === "APPROVED" && <p className="text-xs text-amber-700">Milestone approved. Supplier settlement remains subject to Razorpay Route onboarding and STITCHGRID provider approval.</p>}
                    {m.rejectionReason && <p className="text-xs text-rose-600">Revision requested: {m.rejectionReason}</p>}
                  </div>;
                })}
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">Transaction History</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {allOrders.flatMap((o: any) => (o.paymentTransactions || []).map((t: any) => ({...t, poNumber:o.poNumber}))).length === 0
            ? <p className="py-6 text-sm text-slate-500">No verified transactions yet. Transactions will appear here after successful gateway confirmation.</p>
            : allOrders.flatMap((o: any) => (o.paymentTransactions || []).map((t: any) => ({...t, poNumber:o.poNumber}))).map((t: any) => <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold text-slate-800">{t.poNumber} · {t.razorpayPaymentId || t.razorpayOrderId || t.id}</p><p className="text-xs text-slate-500">{t.paymentMethod || "Razorpay"} · {new Date(t.createdAt).toLocaleString("en-IN")}</p></div><div className="text-right"><p className="font-bold">{money(t.amount,t.currency)}</p><Badge variant={statusTone(t.status) as any}>{t.status}</Badge></div>{isBuyer && t.status === "PAID" && <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><input value={refundReasons[t.id] || ""} onChange={e => setRefundReasons(s => ({...s,[t.id]:e.target.value}))} placeholder="Reason for refund request" className="h-9 rounded-lg border border-slate-300 px-3 text-xs"/><Button size="sm" variant="outline" loading={busy === `refund-${t.id}`} disabled={(t.refunds || []).some((r:any) => ["REQUESTED","PROCESSING","PROCESSED"].includes(r.status))} onClick={() => requestRefund(t.id)}>Request Refund</Button>{(t.refunds || []).map((r:any) => <p key={r.id} className="text-xs text-slate-500 sm:col-span-2">Refund: {r.status}</p>)}</div>}</div>)}
        </div>
      </section>
    </div>
  );
}
