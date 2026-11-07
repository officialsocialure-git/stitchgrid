import { api } from "./api";
import { User, Membership } from "@/types";

export interface SignupInput {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  organizationName: string;
  accountType: "BUYER" | "SUPPLIER" | "BOTH";
  legalName?: string;
  businessType?: string;
  taxId?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  factoryLocation?: string;
  serviceableRegions?: string;
  country?: string;
  description?: string;
  yearsInBusiness?: number;
  establishmentYear?: number;
  productionCapacity?: number;
  monthlyCapacity?: string | number;
  moq?: string | number;
  categories?: string[];
  capabilities?: string[];
  keyProcesses?: string[];
}

export interface AuthSessionResponse {
  accessToken: string;
  user: User;
  activeMembership: Membership | null;
  memberships: Membership[];
  message?: string;
}

export type SignupResponse = AuthSessionResponse;
export type LoginResponse = AuthSessionResponse;
export type VerifyOtpResponse = AuthSessionResponse;

export const authService = {
  signup: async (data: SignupInput): Promise<AuthSessionResponse> => {
    const res = await api.post<AuthSessionResponse>("/auth/signup", data);
    if (typeof window !== "undefined" && res.accessToken) {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (res.activeMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
      }
    }
    return res;
  },

  login: async (identifier: string, password: string): Promise<AuthSessionResponse> => {
    const res = await api.post<AuthSessionResponse>("/auth/login", { identifier, password });
    if (typeof window !== "undefined" && res.accessToken) {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (res.activeMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
      }
    }
    return res;
  },

  googleLogin: async (data: { credential: string }) => {
    const res = await api.post<AuthSessionResponse & { requiresOnboarding: boolean }>("/auth/google", data);
    if (typeof window !== "undefined" && res.accessToken) {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (res.activeMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
      }
    }
    return res;
  },

  forgotPassword: async (identifier: string) => {
    return api.post<{ message: string }>("/auth/forgot-password", { identifier });
  },

  resetPassword: async (token: string, newPassword: string) => {
    return api.post<{ message: string }>("/auth/reset-password", { token, newPassword });
  },

  verifyOtp: async (
    userId: string,
    otp: string,
    destination?: string,
    organizationId?: string,
    role?: string
  ): Promise<AuthSessionResponse> => {
    const res = await api.post<AuthSessionResponse>("/auth/verify-otp", {
      userId,
      otp,
      destination,
      organizationId,
      role,
    });
    if (typeof window !== "undefined" && res.accessToken) {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (res.activeMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
      }
    }
    return res;
  },

  completeGoogleOnboarding: async (data: {
    organizationName: string;
    accountType: "BUYER" | "SUPPLIER";
    legalName?: string;
    businessType?: string;
    taxId?: string;
    address?: string;
    city?: string;
    country?: string;
    description?: string;
    yearsInBusiness?: number;
    productionCapacity?: number;
    categories?: string[];
  }) => {
    const res = await api.post<{ accessToken: string; activeMembership: Membership }>("/auth/google/onboarding", data);
    if (typeof window !== "undefined") {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
      window.dispatchEvent(new CustomEvent("sg_workspace_changed", { detail: res.activeMembership }));
    }
    return res;
  },

  switchContext: async (organizationId: string, role: "BUYER" | "SUPPLIER" | "ADMIN") => {
    const res = await api.post<{
      accessToken: string;
      activeMembership: Membership;
    }>("/auth/switch-context", { organizationId, role });
    if (typeof window !== "undefined") {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
    }
    return res;
  },

  resendOtp: async (destination: string) => {
    return api.post<{ message: string; cooldownRemaining?: number }>("/auth/resend-otp", { destination });
  },

  me: async () => {
    return api.get<{
      id: string;
      fullName: string;
      email?: string;
      phone?: string;
      activeMembership: Membership | null;
      memberships: Membership[];
    }>("/auth/me");
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sg_token");
      localStorage.removeItem("sg_user");
      localStorage.removeItem("sg_membership");
    }
  },
};
