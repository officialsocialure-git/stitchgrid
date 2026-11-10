"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StitchgridLogo } from "@/components/common/StitchgridLogo";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("sg_token");
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <StitchgridLogo size="lg" subtitle="Connecting Buyers and Verified Garment Manufacturers" />
        <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-purple-700">
          <div className="w-2 h-2 rounded-full bg-purple-700 animate-ping" />
          <span>Entering STITCHGRID...</span>
        </div>
      </div>
    </div>
  );
}
