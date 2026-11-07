"use client";
import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
const fetchOrders=(p:URLSearchParams)=>adminService.orders(p);
export default function OrdersPage(){return <AdminResourcePage title="Orders" description="Track purchase orders, sampling requests and production progress." fetcher={fetchOrders} searchPlaceholder="Search PO number, buyer or supplier…" statuses={["PENDING_ACCEPTANCE","ACCEPTED","SAMPLE_PENDING","IN_PRODUCTION","QC_PENDING","DISPATCHED","DELIVERED","COMPLETED","CANCELLED"].map(s=>({label:s.replaceAll("_"," "),value:s}))} columns={[
 {label:"Order ID",render:r=><div><p className="font-semibold text-slate-900">{r.poNumber}</p><p className="text-xs text-slate-500">{r.id}</p></div>},
 {label:"Buyer",render:r=>r.buyer?.name||"—"},
 {label:"Supplier",render:r=>r.supplier?.name||"—"},
 {label:"Amount",render:r=>new Intl.NumberFormat("en-IN",{style:"currency",currency:r.currency||"INR",maximumFractionDigits:0}).format(Number(r.totalAmount||0))},
 {label:"Status",render:r=><Status value={r.status}/>},
 {label:"Expected delivery",render:r=>r.expectedDate?new Date(r.expectedDate).toLocaleDateString():"—"}
 ]}/>;}
