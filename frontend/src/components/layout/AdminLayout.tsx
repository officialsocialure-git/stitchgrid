"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth.service";
import { useNotifications } from "@/hooks/useNotifications";
import {
  Bell, ChevronDown, FileText, Headset, Home, Layers3, LogOut, Menu, Package,
  Search, Settings, ShieldCheck, Users, Wallet, X
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
    <div className="flex h-full flex-col bg-[#120924] text-white">
      {/* Brand Header */}
      <Link
        href="/admin"
        onClick={close}
        className="flex h-[80px] items-center border-b border-[#1E1138] px-5 transition-opacity hover:opacity-90"
      >
        <Image
          src="/stitchgrid-logo-dark.png"
          alt="STITCHGRID Admin"
          width={180}
          height={40}
          priority
          className="h-9 w-auto object-contain"
        />
      </Link>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-6">
        {links.map(({ label, href, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className={`flex min-h-[46px] items-center gap-3.5 rounded-xl px-4 text-sm font-semibold transition ${
                active
                  ? "bg-[#EBE4FF] text-[#5B13EC] shadow-sm font-bold"
                  : "text-[#9E98AD] hover:bg-[#1E1138] hover:text-[#EBE4FF]"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile / Platform Administration Card */}
      <div className="p-3.5 border-t border-[#1E1138]">
        <div className="flex items-center gap-3 rounded-2xl bg-[#1C1038] border border-[#2B1B54] p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#5B13EC]/30">
            <Image
              src="/stitchgrid-symbol.png"
              alt="S"
              width={22}
              height={22}
              className="object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">STITCHGRID Admin</p>
            <p className="truncate text-[11px] text-[#9E98AD]">Platform Administration</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, membership, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleLogout = () => {
    authService.logout();
    router.replace("/login");
  };
  const { notifications, unreadCount, markRead } = useNotifications();

  useEffect(() => {
    if (!loading && (!user || membership?.role !== "ADMIN")) router.replace("/dashboard");
  }, [loading, user, membership?.role, router]);

  if (loading || !user || membership?.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8F9FE] text-sm text-slate-500">
        Checking administrator access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-[#0F172A] md:flex">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[260px] max-w-[85vw] flex-col shadow-2xl">
            <div className="absolute right-2 top-3 z-10">
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-white/80 hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent close={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-40 flex h-[74px] items-center gap-3 border-b border-slate-200/80 bg-white px-4 sm:px-6 lg:px-8 shadow-xs">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 md:hidden"
          >
            <Menu size={20} />
          </button>

          {/* Topbar Search Bar */}
          <div className="relative w-full max-w-[560px]">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  router.push(`/admin/users?q=${encodeURIComponent(search.trim())}`);
                }
              }}
              placeholder="Search suppliers, buyers, RFQs..."
              className="h-10 w-full rounded-full border border-slate-200/90 bg-[#F6F4FA] pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#5B13EC] focus:bg-white focus:ring-2 focus:ring-[#5B13EC]/10"
            />
          </div>

          {/* Right Action Icons & Profile */}
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 transition"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute 1 right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#5B13EC] px-1 text-[9px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold">Notifications</p>
                    <span className="text-xs text-slate-500">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length ? (
                      notifications.slice(0, 12).map((item) => (
                        <button
                          key={item.id}
                          onClick={async () => {
                            try {
                              if (!item.readAt) await markRead(item.id);
                            } finally {
                              setNotificationsOpen(false);
                              router.push("/admin/support");
                            }
                          }}
                          className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {!item.readAt && <span className="h-2 w-2 rounded-full bg-[#5B13EC]" />}
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{item.body}</span>
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="p-6 text-center text-sm text-slate-500">No notifications yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                aria-label="Open admin profile menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 rounded-xl p-1 text-left transition hover:bg-slate-50 focus:outline-none"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-sm font-bold text-[#5B13EC]">
                  {(user.fullName || "Admin").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block max-w-[120px] truncate text-sm font-bold text-slate-900">
                    {user.fullName || "Admin"}
                  </span>
                  <span className="block text-[11px] text-slate-400">Admin</span>
                </span>
                <ChevronDown
                  size={15}
                  className={`hidden text-slate-400 transition-transform sm:block ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileMenuOpen && (
                <>
                  <button
                    aria-label="Close profile menu"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                  >
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.fullName || "Admin"}
                      </p>
                      <p className="text-xs text-slate-500">{user.email || "Administrator"}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut size={17} />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
