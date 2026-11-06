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

export interface SignupResponse {
  userId: string;
  organizationId: string;
  verificationChannel: "email" | "sms";
  message: string;
  devOtp?: string;
}

export interface LoginResponse {
  challengeId: string;
  userId: string;
  destination: string;
  verificationChannel: "email" | "sms";
  message: string;
  devOtp?: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  user: User;
  activeMembership: Membership | null;
  memberships: Membership[];
}

export const authService = {
  signup: async (data: SignupInput) => {
    return api.post<SignupResponse>("/auth/signup", data);
  },

  login: async (identifier: string, password: string) => {
    return api.post<LoginResponse>("/auth/login", { identifier, password });
  },

  googleLogin: async (data: { credential?: string; email?: string; name?: string; googleId?: string }) => {
    const res = await api.post<VerifyOtpResponse>("/auth/google", data);
    if (typeof window !== "undefined" && res.accessToken) {
      localStorage.setItem("sg_token", res.accessToken);
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (res.activeMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(res.activeMembership));
      }
    }
    return res;
  },

  verifyOtp: async (
    userId: string,
    otp: string,
    destination?: string,
    organizationId?: string,
    role?: string
  ) => {
    const res = await api.post<VerifyOtpResponse>("/auth/verify-otp", {
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
    return api.post<{ message: string }>("/auth/resend-otp", { destination });
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

