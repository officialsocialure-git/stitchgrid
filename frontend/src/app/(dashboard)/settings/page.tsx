"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { marketplaceService } from "@/services/marketplace.service";

export default function SettingsPage() {
  const { membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";

  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [productionCapacity, setProductionCapacity] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (membership?.organization) {
      setOrgName(membership.organization.name || "");
      setTaxId(membership.organization.taxId || "");
      setCity(membership.organization.city || "");
      setAddress((membership.organization as any).address || "");

      const profile = (membership.organization as any).supplierProfile;
      if (profile) {
        setDescription(profile.description || "");
        setYearsInBusiness(profile.yearsInBusiness ? String(profile.yearsInBusiness) : "");
        setProductionCapacity(profile.productionCapacity ? String(profile.productionCapacity) : "");
        if (Array.isArray(profile.categories)) {
          setCategories(profile.categories.map((c: any) => (typeof c === "string" ? c : c.category)));
        }
      }
    }
  }, [membership]);

  const handleAddCategory = () => {
    const trimmed = categoryInput.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setCategoryInput("");
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership?.organizationId) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      setSaved(false);

      await marketplaceService.updateOrganizationProfile({
        organizationId: membership.organizationId,
        name: orgName.trim(),
        taxId: taxId.trim(),
        city: city.trim(),
        address: address.trim(),
        description: description.trim() || undefined,
        yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness, 10) : undefined,
        productionCapacity: productionCapacity ? parseInt(productionCapacity, 10) : undefined,
        categories: categories.length > 0 ? categories : undefined,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setErrorMsg(err?.message || "Failed to save profile. Please check your network and inputs.");
    } finally {
      setSaving(false);
    }
  };

  const status = membership?.organization?.verificationStatus || "PENDING";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-surface-container-high">
        <h1 className="font-sans font-bold text-2xl text-on-surface">
          {isSupplier ? "Company Profile & Factory Settings" : "Organization Profile & Compliance"}
        </h1>
        <p className="text-xs text-secondary mt-1">
          {isSupplier
            ? "Manage your factory details, production capacities, GST verification, and manufacturing clusters."
            : "Manage your enterprise credentials, GST verification, and delivery locations."}
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
          <div>
            <h2 className="font-sans font-bold text-base text-on-surface">Verification Status</h2>
            <p className="text-xs text-secondary mt-0.5">
              {status === "APPROVED" ? "Enterprise identity verified" : "Pending identity & GST verification"}
            </p>
          </div>
          <Badge
            variant={status === "APPROVED" ? "success" : "neutral"}
            size="md"
            icon={status === "APPROVED" ? "verified" : "schedule"}
          >
            {status}
          </Badge>
        </div>

        {saved && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span className="font-semibold">Profile details saved directly to MySQL database!</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-secondary uppercase mb-1">
                Organization / Company Name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Textiles Pvt Ltd"
                className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-secondary uppercase mb-1">
                GSTIN / Tax Identification
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="e.g. 29AAAAA0000A1Z5"
                className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm font-mono focus:outline-none focus:border-[#5B13EC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-secondary uppercase mb-1">
                Primary Operating City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai, Tirupur, Noida"
                className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-secondary uppercase mb-1">
                Country
              </label>
              <input
                type="text"
                disabled
                value="India 🇮🇳"
                className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm bg-surface-container-low font-medium cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-secondary uppercase mb-1">
              Registered Address / Factory Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Plot 42, Apparel Park, Phase 2"
              className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
            />
          </div>

          {isSupplier && (
            <>
              <div className="pt-2 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-800 mb-3">Manufacturing Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">
                      Years in Business
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={yearsInBusiness}
                      onChange={(e) => setYearsInBusiness(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">
                      Monthly Production Capacity (pcs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={productionCapacity}
                      onChange={(e) => setProductionCapacity(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary uppercase mb-1">
                  Factory Bio / Equipment & Specializations
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your machinery, specialized garment categories, dyeing facilities, etc."
                  className="w-full p-3 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary uppercase mb-1">
                  Garment Categories & Capabilities
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder="e.g. Knits, Denim, Hoodies, Shirts"
                    className="flex-1 h-10 px-3.5 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-[#5B13EC]"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCategory}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-[#5B13EC] border border-purple-200"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className="text-purple-400 hover:text-purple-700 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="pt-3 flex justify-end">
            <Button variant="primary" size="md" icon="save" type="submit" disabled={saving}>
              {saving ? "Saving to Database..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
