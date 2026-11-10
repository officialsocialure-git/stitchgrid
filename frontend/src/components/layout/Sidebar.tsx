"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAVIGATION_LINKS, APP_NAME } from "@/constants";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils";
import { useNotifications } from "@/hooks/useNotifications";

export function Sidebar() {
  const pathname = usePathname();
  const { membership } = useAuth();
  const role = membership?.role || "BUYER";
  const isBuyer = role === "BUYER";
  const isSupplier = role === "SUPPLIER";
  const { unreadSampleCount } = useNotifications();

  // Navigation Links configuration
  let navLinks: { name: string; href: string; icon: string }[] = [];

  if (isSupplier) {
    // Supplier navigation with simple English labels:
    // Home, Buyer Requests, My Offers, My Orders, Tracking, Samples, Chats, Payments
    navLinks = [
      { name: "Home", href: "/dashboard", icon: "dashboard" },
      { name: "Buyer Requests", href: "/rfqs", icon: "request_quote" },
      { name: "My Offers", href: "/quotations", icon: "description" },
      { name: "My Orders", href: "/orders", icon: "inventory_2" },
      { name: "Tracking", href: "/production", icon: "factory" },
      { name: "Samples", href: "/samples", icon: "checkroom" },
      { name: "Chats", href: "/messages", icon: "chat" },
      { name: "Payments", href: "/payments", icon: "account_balance_wallet" },
    ];
  } else {
    // Buyer navigation with simplified names
    const BUYER_NAME_MAP: Record<string, string> = {
      "Dashboard": "Home",
      "RFQs": "My Requests",
      "Quotations": "My Offers",
      "Purchase Orders": "My Orders",
      "Production Tracking": "Order Tracking",
      "Samples Workflow": "Samples",
      "Messages": "Chat",
      "Escrow & Payments": "Payments",
    };

    navLinks = NAVIGATION_LINKS.filter((item) => {
      if (isBuyer && ["Disputes", "Reviews", "Admin Console"].includes(item.name)) {
        return false;
      }
      if (role !== "ADMIN" && item.name === "Admin Console") {
        return false;
      }
      return true;
    }).map((item) => {
      if (isBuyer && BUYER_NAME_MAP[item.name]) {
        return {
          ...item,
          name: BUYER_NAME_MAP[item.name],
        };
      }
      return item;
    });
  }

  return (
    <aside className="hidden md:flex w-64 border-r border-slate-200/80 bg-white flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="h-16 px-5 flex items-center border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center transition-opacity hover:opacity-90">
          <Image
            src="/stitchgrid-logo-transparent.png"
            alt="STITCHGRID"
            width={185}
            height={41}
            priority
            className="h-9 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {navLinks.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium leading-[1.4] transition-all group",
                isActive
                  ? "bg-[#5B13EC] text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[20px]",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-[#5B13EC]"
                )}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span>{item.name}</span>
              {!isSupplier && item.name === "Samples" && unreadSampleCount > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#5B13EC] text-white text-[10px] font-extrabold flex items-center justify-center">
                  {unreadSampleCount > 99 ? "99+" : unreadSampleCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
