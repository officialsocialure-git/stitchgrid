"use client";
import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
const fetchRfqs=(p:URLSearchParams)=>adminService.rfqs(p);
export default function RfqsPage(){return <AdminResourcePage title="RFQs" description="Monitor buyer requirements, supplier responses and RFQ status." fetcher={fetchRfqs} searchPlaceholder="Search RFQ ID, requirement or buyer…" statuses={[{label:"Open",value:"OPEN"},{label:"Closed",value:"CLOSED"},{label:"Awarded",value:"AWARDED"},{label:"Cancelled",value:"CANCELLED"}]} columns={[
 {label:"RFQ",render:r=><a href={`/admin/rfqs/${r.id}`} className="block"><p className="font-semibold text-slate-900 hover:underline">{r.title}</p><p className="text-xs text-slate-500">{r.id}</p></a>},
 {label:"Buyer",render:r=>r.buyer?.name||"—"},
 {label:"Quantity",render:r=>Number(r.targetQuantity||0).toLocaleString()+" pcs"},
 {label:"Responses",render:r=>r._count?.quotations??0},
 {label:"Status",render:r=><Status value={r.status}/>},
 {label:"Created",render:r=>new Date(r.createdAt).toLocaleDateString()}
 ]} actions={(row,refresh)=>row.status==="OPEN"?<button onClick={async()=>{if(!window.confirm("Close this RFQ?"))return;try{await adminService.updateRfqStatus(row.id,"CLOSED");refresh();}catch(e){window.alert(e instanceof Error?e.message:"Unable to update RFQ.");}}} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50">Close RFQ</button>:<span className="text-xs text-slate-400">No action</span>}/>;}
