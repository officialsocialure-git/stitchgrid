"use client";
import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
const fetchPayments=(p:URLSearchParams)=>adminService.payments(p);
export default function PaymentsPage(){return <AdminResourcePage title="Payments" description="View transaction records and reconciliation status. Payment actions remain read-only until a payment provider is connected." fetcher={fetchPayments} searchPlaceholder="Search transaction reference or provider…" statuses={[{label:"Pending",value:"PENDING"},{label:"Held in escrow",value:"HELD_IN_ESCROW"},{label:"Success",value:"SUCCESS"},{label:"Failed",value:"FAILED"},{label:"Refunded",value:"REFUNDED"}]} columns={[
 {label:"Transaction",render:r=><div><p className="font-semibold text-slate-900">{r.providerRef||r.id}</p><p className="text-xs text-slate-500">{r.provider}</p></div>},
 {label:"Purchase order",render:r=>r.order?.poNumber||r.purchaseOrderId},
 {label:"Buyer / Supplier",render:r=><div><p>{r.order?.buyer?.name||"—"}</p><p className="text-xs text-slate-500">{r.order?.supplier?.name||"—"}</p></div>},
 {label:"Amount",render:r=>new Intl.NumberFormat("en-IN",{style:"currency",currency:r.currency||"INR",maximumFractionDigits:0}).format(Number(r.amount||0))},
 {label:"Status",render:r=><Status value={r.status}/>},
 {label:"Date",render:r=>new Date(r.createdAt).toLocaleDateString()}
 ]}/>;}
