"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { StitchgridLogo } from "@/components/common/StitchgridLogo";

const AVAILABLE_CAPABILITIES = [
  "T-Shirts",
  "Shirts",
  "Hoodies",
  "Activewear",
  "Polo Shirts",
  "Denim & Jeans",
  "Trousers",
  "Dresses",
  "Kids Wear",
  "Knitwear",
  "Woven Fabric",
];

const AVAILABLE_PROCESSES = [
  "Cutting",
  "Stitching",
  "Printing",
  "Embroidery",
  "Washing",
  "Finishing",
  "Packing",
];

const ESTABLISHMENT_YEARS = Array.from({ length: 45 }, (_, i) => 2026 - i);

const SERVICEABLE_REGIONS = [
  "Delhi NCR, UP, Haryana",
  "Tamil Nadu & South India",
  "Gujarat & Western India",
  "Punjab & North India",
  "Bengal & Eastern India",
  "Pan-India (Domestic)",
  "Pan-India & Global Export",
];

const MOQ_OPTIONS = [
  "100 pcs",
  "200 pcs",
  "300 pcs",
  "500 pcs",
  "1,000 pcs",
  "2,500 pcs",
  "5,000 pcs",
];

export default function RegisterPage() {
  const router = useRouter();

  // Multi-step: 1 = Basic Info (Step 2 in diagram), 2 = Manufacturer Details (Step 3 in diagram)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 2 Form States
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [role, setRole] = useState<"Manufacturer" | "Brand / Buyer" | "Both">("Manufacturer");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 (Manufacturer Requirements) Form States
  const [gstNumber, setGstNumber] = useState("");
  const [establishmentYear, setEstablishmentYear] = useState<number>(2018);
  const [factoryLocation, setFactoryLocation] = useState("");
  const [serviceableRegion, setServiceableRegion] = useState("Delhi NCR, UP, Haryana");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([
    "T-Shirts",
    "Shirts",
    "Hoodies",
    "Activewear",
  ]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([
    "Cutting",
    "Stitching",
    "Printing",
    "Washing",
    "Packing",
  ]);
  const [monthlyCapacity, setMonthlyCapacity] = useState("");
  const [moq, setMoq] = useState("300 pcs");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Step 2 submit
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter contact person full name.");
      return;
    }
    if (!organizationName.trim()) {
      setError("Please enter registered organization name.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Please provide work email or mobile number.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid work email address (e.g. name@company.com).");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }

    // If role is Manufacturer or Both, proceed to Step 3 (Manufacturer Details Form)
    if (role === "Manufacturer" || role === "Both") {
      setStep(2);
    } else {
      // Direct registration for Buyer
      executeRegistration();
    }
  };

  // Toggle Capability Tag
  const toggleCapability = (cap: string) => {
    if (selectedCapabilities.includes(cap)) {
      setSelectedCapabilities(selectedCapabilities.filter((c) => c !== cap));
    } else {
      setSelectedCapabilities([...selectedCapabilities, cap]);
    }
  };

  // Toggle Process Checkbox
  const toggleProcess = (proc: string) => {
    if (selectedProcesses.includes(proc)) {
      setSelectedProcesses(selectedProcesses.filter((p) => p !== proc));
    } else {
      setSelectedProcesses([...selectedProcesses, proc]);
    }
  };

  // Final submit
  const executeRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const accountTypeMapped: "BUYER" | "SUPPLIER" | "BOTH" =
      role === "Brand / Buyer" ? "BUYER" : role === "Manufacturer" ? "SUPPLIER" : "BOTH";

    try {
      const payload = {
        fullName: fullName.trim(),
        organizationName: organizationName.trim(),
        accountType: accountTypeMapped,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        // Manufacturer Requirements fields
        gstNumber: gstNumber.trim() || undefined,
        establishmentYear: establishmentYear || undefined,
        factoryLocation: factoryLocation.trim() || undefined,
        serviceableRegions: serviceableRegion || undefined,
        capabilities: selectedCapabilities,
        keyProcesses: selectedProcesses,
        monthlyCapacity: monthlyCapacity.trim() || undefined,
        moq: moq || undefined,
      };

      const res = await authService.signup(payload);
      const dest = email.trim() || phone.trim();
      const devOtpParam = res.devOtp ? `&devOtp=${encodeURIComponent(res.devOtp)}` : "";
      window.location.href = `/verify-otp?userId=${encodeURIComponent(
        res.userId
      )}&channel=${encodeURIComponent(res.verificationChannel)}&dest=${encodeURIComponent(
        dest
      )}&mode=signup${devOtpParam}`;
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed. Please review your details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col items-center w-full mx-auto transition-all ${step === 2 ? "max-w-2xl" : "max-w-md"}`}>
      {/* Step 2: Register Organization (Select Role) */}
      {step === 1 && (
        <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/80 p-7 sm:p-8 flex flex-col">
          {/* Brand Header */}
          <div className="mb-6">
            <StitchgridLogo
              subtitle="Create your business account on India's B2B garment sourcing network."
              size="md"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{error}</span>
              </div>
              {(error.includes("already registered") || error.includes("conflict")) && (
                <Link
                  href="/login"
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700 transition-colors shrink-0"
                >
                  Sign In →
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleStep2Submit} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                CONTACT PERSON FULL NAME *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Amit Sharma"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                REGISTERED ORGANIZATION NAME *
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Asha Apparel Mills Pvt Ltd"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ORGANIZATION ROLE *
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/60">
                {(["Brand / Buyer", "Manufacturer", "Both"] as const).map((r) => {
                  const isActive = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold text-center transition-all ${
                        isActive
                          ? "bg-[#4f14e2] text-white shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WORK EMAIL *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amit@ashapparel.in"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  MOBILE NUMBER *
                </label>
                <div className="relative flex items-center w-full bg-white rounded-xl border border-slate-200 focus-within:border-[#4f14e2] focus-within:ring-2 focus-within:ring-[#4f14e2]/15 shadow-sm transition-all">
                  <div className="pl-3 pr-2 flex items-center text-slate-600 font-mono text-xs font-semibold select-none">
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 h-11 pr-3 text-sm text-slate-900 bg-transparent focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                PASSWORD (MIN 10 CHARACTERS) *
              </label>
              <div className="relative flex items-center w-full bg-white rounded-xl border border-slate-200 focus-within:border-[#4f14e2] focus-within:ring-2 focus-within:ring-[#4f14e2]/15 shadow-sm transition-all">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="flex-1 h-11 px-3.5 text-sm text-slate-900 bg-transparent focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 rounded-xl bg-[#4f14e2] hover:bg-[#4310c4] active:bg-[#380da5] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{role === "Brand / Buyer" ? (loading ? "Creating..." : "Create Account & Verify") : "Create Account & Continue"}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-500">Already registered?</span>
            <Link
              href="/login"
              className="ml-1.5 text-xs font-bold text-[#4f14e2] hover:underline inline-flex items-center gap-0.5"
            >
              <span>Sign In</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </Link>
          </div>
        </div>
      )}

      {/* Step 3: Manufacturer Details (Manufacturer Requirements Form) */}
      {step === 2 && (
        <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/80 p-7 sm:p-8 flex flex-col">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StitchgridLogo size="sm" />
              </div>
              <h1 className="font-sans font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                Manufacturer Details
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Tell us about your manufacturing capability to get verified and receive relevant business opportunities.
              </p>
            </div>

            {/* Progress Step Indicator */}
            <div className="flex flex-col sm:items-end shrink-0">
              <span className="text-[11px] font-mono text-slate-500 font-semibold mb-1">Step 1 of 2</span>
              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                <div className="w-1/2 h-full bg-[#4f14e2] rounded-full"></div>
              </div>
            </div>
          </div>

          {error && (
            <div className="my-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={executeRegistration} className="flex flex-col gap-5 mt-4">
            {/* Section 1: Business & Factory Information */}
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                Business & Factory Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    GST Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    placeholder="09ABCDE1234F1Z5"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Establishment Year *
                  </label>
                  <div className="relative">
                    <select
                      value={establishmentYear}
                      onChange={(e) => setEstablishmentYear(Number(e.target.value))}
                      className="w-full h-10 px-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm appearance-none cursor-pointer"
                    >
                      {ESTABLISHMENT_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[18px]">
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Factory Location *
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={factoryLocation}
                      onChange={(e) => setFactoryLocation(e.target.value)}
                      placeholder="Noida, Uttar Pradesh"
                      className="w-full h-10 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm"
                    />
                    <span className="material-symbols-outlined absolute right-2.5 text-slate-400 text-[18px]">
                      location_on
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Serviceable Regions *
                  </label>
                  <div className="relative">
                    <select
                      value={serviceableRegion}
                      onChange={(e) => setServiceableRegion(e.target.value)}
                      className="w-full h-10 px-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm appearance-none cursor-pointer"
                    >
                      {SERVICEABLE_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[18px]">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Manufacturing Capabilities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Manufacturing Capabilities *
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Click tags to select or remove</span>
              </div>
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-wrap gap-2">
                {selectedCapabilities.map((cap) => (
                  <span
                    key={cap}
                    onClick={() => toggleCapability(cap)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ede8ff] text-[#4f14e2] text-xs font-semibold cursor-pointer hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-xs"
                  >
                    <span>{cap}</span>
                    <span className="text-[13px] font-bold">✕</span>
                  </span>
                ))}
              </div>

              {/* Other capability suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {AVAILABLE_CAPABILITIES.filter((c) => !selectedCapabilities.includes(c)).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-medium hover:border-[#4f14e2] hover:text-[#4f14e2] transition-colors"
                  >
                    + {cap}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3: Key Processes / Operations */}
            <div>
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Key Processes / Operations *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {AVAILABLE_PROCESSES.map((proc) => {
                  const isChecked = selectedProcesses.includes(proc);
                  return (
                    <label
                      key={proc}
                      onClick={() => toggleProcess(proc)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none ${
                        isChecked
                          ? "bg-[#ede8ff]/60 border-[#4f14e2] text-[#4f14e2] font-semibold"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 rounded text-[#4f14e2] focus:ring-[#4f14e2] cursor-pointer"
                      />
                      <span>{proc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Capacity & MOQ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Monthly Production Capacity *
                </label>
                <input
                  type="text"
                  required
                  value={monthlyCapacity}
                  onChange={(e) => setMonthlyCapacity(e.target.value)}
                  placeholder="50,000 pcs"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Minimum Order Quantity (MOQ) *
                </label>
                <div className="relative">
                  <select
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="w-full h-10 px-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#4f14e2] focus:ring-2 focus:ring-[#4f14e2]/15 shadow-sm appearance-none cursor-pointer"
                  >
                    {MOQ_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[18px]">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-6 h-12 rounded-xl bg-[#4f14e2] hover:bg-[#4310c4] active:bg-[#380da5] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{loading ? "Registering..." : "Save & Get OTP"}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step Indicator Pill */}
      <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/80 shadow-xs">
        <span className="w-5 h-5 rounded-full bg-[#4f14e2] text-white text-[11px] font-bold flex items-center justify-center">
          {step === 1 ? "2" : "3"}
        </span>
        <span className="font-semibold text-slate-800">
          {step === 1 ? "Register Organization (Select Role)" : "Manufacturer Requirements Form"}
        </span>
      </div>
    </div>
  );
}
