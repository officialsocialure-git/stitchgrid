type SupplierProfileCompletionSource = {
  name?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  city?: string | null;
  address?: string | null;
  businessType?: string | null;
  supplierProfile?: {
    description?: string | null;
    productionCapacity?: number | null;
    minimumOrderQuantity?: number | null;
    fabricMinimumOrderQuantity?: number | null;
    yearsInBusiness?: number | null;
    categories?: unknown[];
    capabilities?: { capabilityGroup?: string | null }[];
  } | null;
};

/**
 * Single source of truth for the supplier profile completion shown on
 * both the Supplier Dashboard and My Business Profile screen.
 */
export function getSupplierProfileCompletion(
  profile: SupplierProfileCompletionSource | null | undefined,
  catalogCount: number,
): number {
  if (!profile) return 0;
  const supplier = profile.supplierProfile;
  const checks = [
    !!profile.name,
    !!profile.legalName,
    !!profile.taxId,
    !!profile.city,
    !!profile.address,
    !!profile.businessType,
    !!supplier?.description,
    supplier?.productionCapacity != null,
    supplier?.minimumOrderQuantity != null || supplier?.fabricMinimumOrderQuantity != null,
    supplier?.yearsInBusiness != null,
    !!supplier?.categories?.length,
    !!supplier?.capabilities?.some(item => item.capabilityGroup === 'FABRIC'),
    !!supplier?.capabilities?.some(item => item.capabilityGroup === 'SERVICE'),
    catalogCount > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
