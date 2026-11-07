"use client";
import { AdminResourcePage, Status } from "@/features/admin/AdminResourcePage";
import { adminService } from "@/features/admin/admin.service";
const fetchUsers = (p: URLSearchParams) => { const next = new URLSearchParams(p); const role = next.get("status") || "ALL"; next.delete("status"); next.set("role", role); return adminService.users(next); };
export default function UsersPage() {
  return <AdminResourcePage title="Users" description="Manage buyer, supplier and administrator accounts." fetcher={fetchUsers} searchPlaceholder="Search name, company, email or phone…" statuses={[{label:"Buyers",value:"BUYER"},{label:"Suppliers",value:"SUPPLIER"},{label:"Admins",value:"ADMIN"}]} statusLabel="All Roles"
    columns={[
      {label:"User",render:r=><div><p className="font-semibold text-slate-900">{r.fullName}</p><p className="text-xs text-slate-500">{r.email || r.phone || "No contact details"}</p></div>},
      {label:"Business",render:r=><div className="max-w-[220px] truncate">{r.memberships?.map((m:any)=>m.organization?.name).filter(Boolean).join(", ") || "—"}</div>},
      {label:"Role",render:r=><div className="flex flex-wrap gap-1">{r.memberships?.map((m:any)=><span key={m.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold">{m.role}</span>)}</div>},
      {label:"Account",render:r=><Status value={r.isActive ? "Active" : "Inactive"}/>},
      {label:"Joined",render:r=>new Date(r.createdAt).toLocaleDateString()}
    ]}
    actions={(row,refresh)=><button onClick={async()=>{try{await adminService.updateUserStatus(row.id,!row.isActive);refresh();}catch(e){window.alert(e instanceof Error?e.message:"Unable to update account.");}}} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${row.isActive?"border-rose-200 text-rose-700 hover:bg-rose-50":"border-lime-300 bg-lime-50 text-slate-800 hover:bg-lime-100"}`}>{row.isActive?"Deactivate":"Activate"}</button>}
  />;
}