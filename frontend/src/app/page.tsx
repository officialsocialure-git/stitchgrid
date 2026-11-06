"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sg_token") : null;
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center animate-spin">
          <span className="material-symbols-outlined text-[24px]">layers</span>
        </div>
        <p className="font-sans font-bold text-sm text-primary">Entering STITCHGRID...</p>
      </div>
    </div>
  );
}
