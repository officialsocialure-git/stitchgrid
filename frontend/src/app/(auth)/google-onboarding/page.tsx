"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { StitchgridLogo } from "@/components/common/StitchgridLogo";

const CATEGORIES = ["T-Shirts", "Shirts", "Hoodies", "Activewear", "Polo Shirts", "Denim & Jeans", "Trousers", "Dresses", "Kids Wear", "Knitwear", "Woven Fabric"];

export default function GoogleOnboardingPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"BUYER" | "SUPPLIER">("BUYER");
  const [organizationName, setOrganizationName] = useState("");
  const [city, setCity] = useState("");
  const [taxId, setTaxId] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (!localStorage.getItem("sg_token")) router.replace("/login");
  }, [router]);

  const toggleCategory = (category: string) => {
    setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (organizationName.trim().length < 2) {
      setError("Please enter your organization name.");
      return;
    }
    if (accountType === "SUPPLIER" && categories.length === 0) {
      setError("Please select at least one manufacturing category.");
      return;
    }
    setLoading(true);
    try {
      await authService.completeGoogleOnboarding({
        organizationName: organizationName.trim(),
        accountType,
        city: city.trim() || undefined,
        taxId: taxId.trim() || undefined,
        description: description.trim() || undefined,
        categories: accountType === "SUPPLIER" ? categories : undefined,
        businessType: accountType === "SUPPLIER" ? "Garments & Textiles" : "Brand / Buyer",
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete your organization setup.");
      setLoading(false);
    }
  };

  return (
    <main className="w-full max-w-xl mx-auto px-2">
      <section className="bg-white rounded-3xl border border-purple-100 shadow-xl p-6 sm:p-9">
        <div className="mb-6"><StitchgridLogo subtitle="Complete your business profile to get started." size="md" /></div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-[1.2]">Set up your organization</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6 leading-[1.5]">Choose how you will use STITCHGRID. You can continue once your organization details are saved.</p>

        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">Account type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAccountType("BUYER")} className={`rounded-xl border p-4 text-left transition ${accountType === "BUYER" ? "border-purple-600 bg-purple-50 ring-2 ring-purple-100" : "border-slate-200"}`}>
                <span className="block font-semibold text-slate-900">Buyer / Brand</span>
                <span className="block text-xs text-slate-500 mt-1">Source garments from manufacturers</span>
              </button>
              <button type="button" onClick={() => setAccountType("SUPPLIER")} className={`rounded-xl border p-4 text-left transition ${accountType === "SUPPLIER" ? "border-purple-600 bg-purple-50 ring-2 ring-purple-100" : "border-slate-200"}`}>
                <span className="block font-semibold text-slate-900">Supplier / Manufacturer</span>
                <span className="block text-xs text-slate-500 mt-1">Receive requests and fulfil orders</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="org-name" className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">Organization name *</label>
            <input id="org-name" required minLength={2} maxLength={150} value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Your company or brand name" className="w-full h-12 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100" />
          </div>

          <div>
            <label htmlFor="city" className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">City</label>
            <input id="city" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Noida" className="w-full h-12 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100" />
          </div>

          {accountType === "SUPPLIER" && <>
            <div>
              <label htmlFor="tax-id" className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">GST / Tax ID (optional)</label>
              <input id="tax-id" maxLength={30} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="GSTIN" className="w-full h-12 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">Manufacturing categories *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => <button key={category} type="button" onClick={() => toggleCategory(category)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${categories.includes(category) ? "border-purple-600 bg-purple-100 text-purple-800" : "border-slate-200 text-slate-600"}`}>{category}</button>)}
              </div>
            </div>
            <div>
              <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">Business description (optional)</label>
              <textarea id="description" maxLength={2000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell buyers about your manufacturing capabilities" className="w-full rounded-xl border border-slate-200 p-3.5 text-sm text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100" />
            </div>
          </>}

          <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold disabled:opacity-60">{loading ? "Saving organization..." : "Complete Setup & Continue"}</button>
        </form>
      </section>
    </main>
  );
}
