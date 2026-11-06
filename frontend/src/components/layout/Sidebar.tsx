"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_LINKS, APP_NAME } from "@/constants";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { membership } = useAuth();
  const role = membership?.role || "BUYER";
  const isBuyer = role === "BUYER";
  const isSupplier = role === "SUPPLIER";

  // Navigation Links configuration
  let navLinks: { name: string; href: string; icon: string }[] = [];

  if (isSupplier) {
    // Supplier navigation with simple English labels:
    // Home, Buyer Requests, My Quotes, My Orders, Tracking, Samples, Chats, Payments
    navLinks = [
      { name: "Home", href: "/dashboard", icon: "dashboard" },
      { name: "Buyer Requests", href: "/rfqs", icon: "request_quote" },
      { name: "My Quotes", href: "/quotations", icon: "description" },
      { name: "My Orders", href: "/orders", icon: "inventory_2" },
      { name: "Tracking", href: "/production", icon: "factory" },
      { name: "Samples", href: "/samples", icon: "checkroom" },
      { name: "Chats", href: "/messages", icon: "chat" },
      { name: "Payments", href: "/payments", icon: "account_balance_wallet" },
    ];
  } else {
    // Buyer navigation with simplified names
    const BUYER_NAME_MAP: Record<string, string> = {
      "RFQs": "My Requests",
      "Quotations": "Supplier Quotes",
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
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-[#5B13EC] flex items-center justify-center text-white shadow-xs">
          <span className="material-symbols-outlined text-[20px]">layers</span>
        </div>
        <div className="flex flex-col">
          <span className="font-sans font-extrabold text-base tracking-tight text-slate-900 leading-none">
            {APP_NAME}
          </span>
          <span className="text-[10px] font-mono text-[#5B13EC] font-bold uppercase tracking-wider mt-0.5">
            Garment Network
          </span>
        </div>
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
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all group",
                isActive
                  ? "bg-[#5B13EC] text-white shadow-xs"
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
            </Link>
          );
        })}
      </nav>

      {/* Verified Status Badge Footer - Matches Reference Image */}
      <div className="p-4 border-t border-slate-100">
        {isSupplier ? (
          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">
                check
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate">GST Verified</span>
              <span className="text-[10px] text-slate-500 font-medium">Supplier Account</span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#5B13EC] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                verified
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate">GST &amp; Tirupur Verified</span>
              <span className="text-[10px] text-slate-500 font-medium">B2B Escrow Protected</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
