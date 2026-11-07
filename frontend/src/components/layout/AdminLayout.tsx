"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import {
  Bell, ChevronDown, FileText, Headset, Home, Layers3, Menu, Package,
  Search, Settings, ShieldCheck, Users, X
} from "lucide-react";

const links = [
  { label: "Overview", href: "/admin", icon: Home },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Verification", href: "/admin/verification", icon: ShieldCheck },
  { label: "Marketplace", href: "/admin/marketplace", icon: Layers3 },
  { label: "RFQs", href: "/admin/rfqs", icon: FileText },
  { label: "Orders", href: "/admin/orders", icon: Package },
  { label: "Payments", href: "/admin/payments", icon: Wallet },
  { label: "Support", href: "/admin/support", icon: Headset },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

function SidebarContent({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <Link href="/admin" onClick={close} className="flex h-[84px] items-center gap-3 border-b border-white/10 px-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#D9F66A] text-[25px] font-black text-[#102536]">S</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[18px] font-extrabold tracking-[.12em] text-white">STITCHGRID</span>
          <span className="mt-1 block text-[11px] font-medium tracking-wide text-slate-300">The Garment Network</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {links.map(({ label, href, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={close}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${active ? "bg-[#D9F66A] text-[#142536] shadow-sm" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={19} strokeWidth={2.1} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-[11px] text-slate-400">STITCHGRID Platform Administration</div>
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, membership, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { notifications, unreadCount, markRead } = useNotifications();

  useEffect(() => {
    if (!loading && (!user || membership?.role !== "ADMIN")) router.replace("/dashboard");
  }, [loading, user, membership?.role, router]);

  if (loading || !user || membership?.role !== "ADMIN") {
    return <div className="grid min-h-screen place-items-center bg-[#F7F9FC] text-sm text-slate-500">Checking administrator access…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#111C2D] md:flex">
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col bg-[#102536] md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-[#102536] shadow-2xl">
            <div className="flex justify-end px-3 pt-3"><button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white hover:bg-white/10"><X size={20}/></button></div>
            <SidebarContent close={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-[76px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"><Menu size={20}/></button>
          <div className="relative w-full max-w-[620px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && search.trim()) router.push(`/admin/users?q=${encodeURIComponent(search.trim())}`); }}
              placeholder="Search suppliers, buyers, RFQs…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-[#A8D92D] focus:bg-white"/>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
            <div className="relative"><button aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(v => !v)} className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100"><Bell size={21}/>{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>{notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><p className="text-sm font-bold">Notifications</p><span className="text-xs text-slate-500">{unreadCount} unread</span></div><div className="max-h-[360px] overflow-y-auto">{notifications.length ? notifications.slice(0,12).map(item => <button key={item.id} onClick={async()=>{try{if(!item.readAt) await markRead(item.id);}finally{setNotificationsOpen(false);router.push("/admin/support");}}} className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><span className="flex items-center gap-2 text-sm font-semibold">{!item.readAt && <span className="h-2 w-2 rounded-full bg-[#A8D92D]"/>}{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.body}</span><span className="mt-1 block text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</span></button>) : <p className="p-6 text-center text-sm text-slate-500">No notifications yet.</p>}</div></div>}</div>
            <span className="hidden h-9 w-px bg-slate-200 sm:block"/>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#D9F66A] text-sm font-extrabold text-[#142536]">{(user.fullName || "Admin").split(" ").map((v: string) => v[0]).slice(0,2).join("").toUpperCase()}</span>
              <span className="hidden leading-tight sm:block"><span className="block max-w-[150px] truncate text-sm font-bold">{user.fullName}</span><span className="mt-1 block text-xs text-slate-500">Admin</span></span>
              <ChevronDown size={17} className="hidden text-slate-500 sm:block"/>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
