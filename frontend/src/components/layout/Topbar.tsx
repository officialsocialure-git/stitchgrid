"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth.service";
import { NAVIGATION_LINKS, APP_NAME } from "@/constants";
import { Role } from "@/types";
import { cn } from "@/utils";
import { useNotifications } from "@/hooks/useNotifications";

export function Topbar() {
  const { user, membership } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markRead } = useNotifications();

  const openNotification = async (notification: { id: string; title: string }) => {
    try {
      if (!notifications.find((item) => item.id === notification.id)?.readAt) {
        await markRead(notification.id);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
    setNotificationsOpen(false);
    router.push(notification.title === "Sample received" ? "/samples" : "/messages");
  };

  const activeRole: Role = (membership?.role as Role) || "BUYER";
  const isBuyer = activeRole === "BUYER";

  const handleLogout = () => {
    authService.logout();
    router.push("/login");
  };

  const initial = user?.fullName ? user.fullName[0].toUpperCase() : "S";
  const displayName = isBuyer
    ? (user?.fullName || "Sumit")
    : (membership?.organization?.name || user?.fullName || "Sumit Textiles");
  const roleDisplay = isBuyer ? "Buyer" : "Supplier";

  // Navigation Links for Mobile Drawer (Supplier)
  const SUPPLIER_NAV_LINKS = [
    { name: "Home", href: "/dashboard", icon: "dashboard" },
    { name: "Buyer Requests", href: "/rfqs", icon: "request_quote" },
    { name: "My Offers", href: "/quotations", icon: "description" },
    { name: "My Orders", href: "/orders", icon: "inventory_2" },
    { name: "Tracking", href: "/production", icon: "factory" },
    { name: "Samples", href: "/samples", icon: "checkroom" },
    { name: "Chats", href: "/messages", icon: "chat" },
    { name: "Payments", href: "/payments", icon: "account_balance_wallet" },
  ];

  // Simple names mapping for Buyer section in mobile menu
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

  const navLinks = isBuyer
    ? NAVIGATION_LINKS.filter((item) => {
        if (["Disputes", "Reviews", "Admin Console"].includes(item.name)) {
          return false;
        }
        return true;
      }).map((item) => {
        if (BUYER_NAME_MAP[item.name]) {
          return { ...item, name: BUYER_NAME_MAP[item.name] };
        }
        return item;
      })
    : SUPPLIER_NAV_LINKS;

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between">
      {/* Left: Brand Logo (Matches Reference Image) */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 md:hidden transition-colors"
          title="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-[24px]">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
        </button>

        {/* Brand Logo Link (Only shown on mobile when sidebar is hidden) */}
        <Link href="/dashboard" className="flex md:hidden items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#5B13EC] flex items-center justify-center text-white shadow-xs group-hover:bg-[#4d0ecf] transition-colors">
            <span className="material-symbols-outlined text-[20px]">layers</span>
          </div>
          <div className="flex flex-col">
            <span className="font-sans font-extrabold text-sm sm:text-base tracking-tight text-gray-900 leading-none">
              {APP_NAME}
            </span>
            <span className="text-[10px] font-mono text-[#5B13EC] font-bold uppercase tracking-wider mt-0.5">
              Garment Network
            </span>
          </div>
        </Link>
      </div>

      {/* Right Section: Mobile vs Desktop */}
      <div className="flex items-center">
        {/* MOBILE VIEW (Matches Reference Image 1 & 2) */}
        <div className="flex items-center gap-2 md:hidden relative">
          {/* Notifications */}
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="w-10 h-10 rounded-full bg-[#f4effc] text-[#5B13EC] relative flex items-center justify-center border border-purple-100/60 shadow-2xs hover:bg-purple-100 transition-colors"
            title="Notifications"
            aria-label="Open notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>

          {/* Circular Profile Avatar Button (Toggles Dropdown from Reference Image 2) */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="w-10 h-10 rounded-full bg-[#f4effc] text-[#5B13EC] flex items-center justify-center border border-purple-100/60 shadow-2xs hover:bg-purple-100 transition-colors"
            title="Profile Menu"
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
          </button>

          {/* Mobile Profile Dropdown (Matches Reference Image 2) */}
          {profileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileMenuOpen(false)}
              />
              <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 animate-fadeIn">
                <Link
                  href="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-800 hover:bg-purple-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[19px] text-gray-500">person</span>
                  <span>My Profile</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-800 hover:bg-purple-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[19px] text-gray-500">settings</span>
                  <span>Account Settings</span>
                </Link>
                <div className="h-[1px] bg-gray-100 my-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[19px] text-red-600">logout</span>
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* DESKTOP VIEW (hidden md:flex) */}
        <div className="hidden md:flex items-center">
          {/* Notifications */}
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors relative flex items-center justify-center"
            title="Notifications"
            aria-label="Open notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>

          {/* Vertical Divider */}
          <div className="h-7 w-[1px] bg-slate-200 mx-2 sm:mx-3"></div>

          {/* User Profile Info */}
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f4effc] text-[#5B13EC] font-bold text-xs sm:text-sm flex items-center justify-center border border-purple-100 shadow-2xs select-none">
              {initial}
            </div>

            {/* User Name & Role */}
            <div className="flex flex-col text-left">
              <span className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {roleDisplay}
              </span>
            </div>
          </div>

          {/* Logout Icon Button */}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors ml-2 sm:ml-3 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>

      {notificationsOpen && (
        <div className="absolute right-3 sm:right-6 top-[calc(100%-2px)] z-50 w-[min(92vw,380px)] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            <span className="text-xs text-slate-500">{unreadCount} unread</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 text-center">You are all caught up.</p>
            ) : notifications.slice(0, 8).map((notification) => (
              <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-purple-50 transition-colors ${notification.readAt ? "bg-white" : "bg-purple-50/70"}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-900">{notification.title}</span>
                  {!notification.readAt && <span className="w-2 h-2 rounded-full bg-[#5B13EC] shrink-0" />}
                </span>
                <span className="block mt-1 text-xs text-slate-600">{notification.body}</span>
                <span className="block mt-1 text-[10px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-black/40 backdrop-blur-xs md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-64 h-full bg-white border-r border-slate-200 p-4 space-y-1 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all",
                    isActive
                      ? "bg-[#5B13EC] text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined text-[20px]",
                      isActive ? "text-white" : "text-gray-400"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                  {isBuyer && item.name === "Samples" && notifications.filter((notification) => notification.title === "Sample received" && !notification.readAt).length > 0 && (
                    <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#5B13EC] text-white text-[10px] font-extrabold flex items-center justify-center">
                      {notifications.filter((notification) => notification.title === "Sample received" && !notification.readAt).length}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
