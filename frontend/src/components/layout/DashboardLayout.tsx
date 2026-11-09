"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/utils";
import { AdminLayout } from "./AdminLayout";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { membership, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isSupplier = membership?.role === "SUPPLIER";

  useEffect(() => {
    if (!loading && typeof window !== "undefined") {
      const token = localStorage.getItem("sg_token");
      if (!token) {
        router.push("/login");
      }
    }
  }, [loading, router]);

  if (loading && typeof window !== "undefined" && !localStorage.getItem("sg_token")) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-secondary">Securing STITCHGRID workspace...</span>
        </div>
      </div>
    );
  }

  if (membership?.role === "ADMIN" || pathname.startsWith("/admin")) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  // Mobile Bottom Navigation items (Matches reference mobile screenshot)
  const mobileNavItems = isSupplier
    ? [
        { name: "Home", href: "/dashboard", icon: "home" },
        { name: "Buyer Requests", href: "/rfqs", icon: "format_list_bulleted" },
        { name: "My Orders", href: "/orders", icon: "inventory_2" },
        { name: "Messages", href: "/messages", icon: "chat", badge: 3 },
        { name: "Profile", href: "/settings", icon: "person" },
      ]
    : [
        { name: "Dashboard", href: "/dashboard", icon: "dashboard" },
        { name: "Requests", href: "/rfqs", icon: "request_quote" },
        { name: "Orders", href: "/orders", icon: "inventory_2" },
        { name: "Chat", href: "/messages", icon: "chat" },
        { name: "Settings", href: "/settings", icon: "settings" },
      ];

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (Matches Reference Image 2) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200/90 z-40 flex items-center justify-around px-2 shadow-lg">
          {mobileNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all relative",
                  isActive
                    ? "bg-[#f4effc] text-[#5B13EC]"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-[#5B13EC] text-white text-[9px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight mt-0.5",
                    isActive ? "font-bold text-[#5B13EC]" : "font-medium text-slate-500"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

