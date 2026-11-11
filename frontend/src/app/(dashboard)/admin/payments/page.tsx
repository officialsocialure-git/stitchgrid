"use client";

import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
import { SupplierPaymentSetups } from "@/features/admin/SupplierPaymentSetups";
import { AdminPaymentRefunds } from "@/features/admin/AdminPaymentRefunds";

const fetchPayments = (params: URLSearchParams) => adminService.payments(params);
const PAYMENT_REALTIME_TOPICS = ["payment:created", "payment:updated", "payment:setup_updated", "payment:refund_updated"];

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <SupplierPaymentSetups />
      <AdminPaymentRefunds />
      <AdminResourcePage
        title="Payments"
        description="Monitor verified Razorpay collections, milestone payments and settlement status across STITCHGRID."
        fetcher={fetchPayments}
        realtimeTopics={PAYMENT_REALTIME_TOPICS}
        searchPlaceholder="Search transaction reference or provider…"
        statuses={[
          { label: "Pending", value: "PENDING" },
          { label: "Paid", value: "PAID" },
          { label: "Approved", value: "APPROVED" },
          { label: "Released", value: "RELEASED" },
          { label: "Failed", value: "FAILED" },
          { label: "Refunded", value: "REFUNDED" }
        ]}
        columns={[
          { label: "Transaction", render: r => <div><p className="font-semibold text-slate-900">{r.razorpayPaymentId || r.providerRef || r.id}</p><p className="text-xs text-slate-500">{r.provider}</p></div> },
          { label: "Purchase order", render: r => <div><p>{r.order?.poNumber || r.purchaseOrderId}</p><p className="text-xs text-slate-500">{r.paymentMilestone?.title || "Milestone payment"}</p></div> },
          { label: "Buyer / Supplier", render: r => <div><p>{r.order?.buyer?.name || "—"}</p><p className="text-xs text-slate-500">{r.order?.supplier?.name || "—"}</p></div> },
          { label: "Amount", render: r => new Intl.NumberFormat("en-IN", { style: "currency", currency: r.currency || "INR", maximumFractionDigits: 0 }).format(Number(r.amount || 0)) },
          { label: "Status", render: r => <Status value={r.status} /> },
          { label: "Date", render: r => new Date(r.createdAt).toLocaleDateString() }
        ]}
      />
    </div>
  );
}
