"use client";
import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
import { api } from "@/services/api";
const fetchDisputes=(p:URLSearchParams)=>adminService.disputes(p);
export default function SupportPage(){return <AdminResourcePage title="Support & Disputes" description="Review buyer and supplier disputes and record resolution decisions." fetcher={fetchDisputes} searchPlaceholder="Search dispute reason or ID…" statuses={[{label:"Open",value:"OPEN"},{label:"Under review",value:"UNDER_REVIEW"},{label:"Resolved",value:"RESOLVED"},{label:"Rejected",value:"REJECTED"}]} columns={[
 {label:"Case",render:r=><div><p className="font-semibold text-slate-900">{r.id}</p><p className="max-w-[260px] truncate text-xs text-slate-500">{r.reason}</p></div>},
 {label:"Raised by",render:r=>r.raisedBy?.fullName||"—"},
 {label:"Order",render:r=>r.order?.poNumber||"—"},
 {label:"Buyer / Supplier",render:r=><div><p>{r.order?.buyer?.name||"—"}</p><p className="text-xs text-slate-500">{r.order?.supplier?.name||"—"}</p></div>},
 {label:"Status",render:r=><Status value={r.status}/>},
 {label:"Opened",render:r=>new Date(r.createdAt).toLocaleDateString()}
 ]} actions={(row,refresh)=>["OPEN","UNDER_REVIEW"].includes(row.status)?<button onClick={async()=>{const resolution=window.prompt("Enter the support resolution note:");if(!resolution?.trim())return;try{await api.patch(`/admin/disputes/${row.id}`,{status:"RESOLVED",resolution});refresh();}catch(e){window.alert(e instanceof Error?e.message:"Unable to resolve case.");}}} className="rounded-lg bg-[#D9F66A] px-3 py-2 text-xs font-bold">Resolve</button>:<span className="text-xs text-slate-400">Closed</span>}/>;}
