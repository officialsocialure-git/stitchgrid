export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://localhost:5000/api");

export const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "")
    : "https://stitchgrid-backend.onrender.com");

export const APP_NAME = "STITCHGRID";

export const NAVIGATION_LINKS = [
  { name: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { name: "RFQs", href: "/rfqs", icon: "request_quote" },
  { name: "Quotations", href: "/quotations", icon: "compare_arrows" },
  { name: "Purchase Orders", href: "/orders", icon: "inventory_2" },
  { name: "Production Tracking", href: "/production", icon: "factory" },
  { name: "Samples Workflow", href: "/samples", icon: "checkroom" },
  { name: "Messages", href: "/messages", icon: "chat" },
  { name: "Escrow & Payments", href: "/payments", icon: "account_balance_wallet" },
  { name: "Disputes", href: "/disputes", icon: "gavel" },
  { name: "Reviews", href: "/reviews", icon: "star" },
  { name: "Admin Console", href: "/admin", icon: "admin_panel_settings" },
  { name: "Organization Settings", href: "/settings", icon: "settings" },
];

export const GARMENT_CLUSTERS = [
  { name: "Tirupur", state: "Tamil Nadu", spec: "Knits & Cotton Hosiery", units: "320+ Export Units" },
  { name: "Surat", state: "Gujarat", spec: "Synthetic Fabric & Manmade Yarns", units: "480+ Weaver Looms" },
  { name: "Ludhiana", state: "Punjab", spec: "Woollen & Winter Wear", units: "190+ Mills" },
  { name: "Jaipur", state: "Rajasthan", spec: "Block Prints & Ethnic Cottons", units: "210+ Boutiques" },
];

