"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarketplaceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Marketplace is now integrated directly into the Buyer Dashboard
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-secondary">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
        <p className="text-sm font-medium">Redirecting to Supplier Network Dashboard...</p>
      </div>
    </div>
  );
}
