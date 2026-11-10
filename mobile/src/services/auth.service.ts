import { api } from "./api";
import { storage } from "../utils/storage";
import { User, Membership, Role } from "../types";

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
  country?: string;
  description?: string;
  yearsInBusiness?: number;
  productionCapacity?: number;
  categories?: string[];
}

export interface AuthSessionResponse {
  accessToken: string;
  user: User;
  activeMembership: Membership | null;
  memberships: Membership[];
  message?: string;
}

export const authService = {
  async signup(data: SignupInput): Promise<AuthSessionResponse> {
    const res = await api.post("/auth/signup", data);
    const session: AuthSessionResponse = res.data?.data || res.data;
    if (session.accessToken) {
      await storage.setToken(session.accessToken);
      await storage.setItem("stitchguard_user", JSON.stringify(session.user));
      if (session.activeMembership) {
        await storage.setItem("stitchguard_membership", JSON.stringify(session.activeMembership));
      }
    }
    return session;
  },

  async login(identifier: string, password: string): Promise<AuthSessionResponse> {
    const res = await api.post("/auth/login", { identifier, password });
    const session: AuthSessionResponse = res.data?.data || res.data;
    if (session.accessToken) {
      await storage.setToken(session.accessToken);
      await storage.setItem("stitchguard_user", JSON.stringify(session.user));
      if (session.activeMembership) {
        await storage.setItem("stitchguard_membership", JSON.stringify(session.activeMembership));
      }
    }
    return session;
  },

  async forgotPassword(identifier: string): Promise<{ message: string }> {
    const res = await api.post("/auth/forgot-password", { identifier });
    return res.data?.data || res.data;
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await api.post("/auth/reset-password", { token, newPassword });
    return res.data?.data || res.data;
  },

  async verifyOtp(userId: string, otp: string, destination?: string): Promise<AuthSessionResponse> {
    const res = await api.post("/auth/verify-otp", { userId, otp, destination });
    const session: AuthSessionResponse = res.data?.data || res.data;
    if (session.accessToken) {
      await storage.setToken(session.accessToken);
      await storage.setItem("stitchguard_user", JSON.stringify(session.user));
      if (session.activeMembership) {
        await storage.setItem("stitchguard_membership", JSON.stringify(session.activeMembership));
      }
    }
    return session;
  },

  async switchContext(organizationId: string, role: Role): Promise<{ accessToken: string; activeMembership: Membership }> {
    const res = await api.post("/auth/switch-context", { organizationId, role });
    const data = res.data?.data || res.data;
    if (data.accessToken) {
      await storage.setToken(data.accessToken);
      await storage.setItem("stitchguard_membership", JSON.stringify(data.activeMembership));
    }
    return data;
  },

  async googleLogin(credential: string): Promise<AuthSessionResponse & { requiresOnboarding?: boolean }> {
    const res = await api.post("/auth/google", { credential });
    const session = res.data?.data || res.data;
    if (session.accessToken) {
      await storage.setToken(session.accessToken);
      await storage.setItem("stitchguard_user", JSON.stringify(session.user));
      if (session.activeMembership) {
        await storage.setItem("stitchguard_membership", JSON.stringify(session.activeMembership));
      }
    }
    return session;
  },

  async completeGoogleOnboarding(data: {
    organizationName: string;
    accountType: "BUYER" | "SUPPLIER";
  }): Promise<{ accessToken: string; activeMembership: Membership }> {
    const res = await api.post("/auth/google/onboarding", data);
    const result = res.data?.data || res.data;
    if (result.accessToken) {
      await storage.setToken(result.accessToken);
      if (result.activeMembership) {
        await storage.setItem("stitchguard_membership", JSON.stringify(result.activeMembership));
      }
    }
    return result;
  },

  async me(): Promise<{
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    activeMembership: Membership | null;
    memberships: Membership[];
  }> {
    const res = await api.get("/auth/me");
    return res.data?.data || res.data;
  },

  async logout(): Promise<void> {
    await storage.clearAll();
  },
};

