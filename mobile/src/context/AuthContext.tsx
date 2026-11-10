import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, Membership, Role } from "../types";
import { authService, SignupInput } from "../services/auth.service";
import { storage } from "../utils/storage";
import { realtimeService } from "../services/realtime.service";

interface AuthContextType {
  user: User | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  token: string | null;
  isLoading: boolean;
  isBuyer: boolean;
  isSupplier: boolean;
  isAdmin: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  signup: (data: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: "BUYER" | "SUPPLIER") => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedToken = await storage.getToken();
      if (!savedToken) {
        setIsLoading(false);
        return;
      }
      setToken(savedToken);

      // Validate session with /auth/me
      const me = await authService.me();
      if (me) {
        setUser({
          id: me.id,
          fullName: me.fullName,
          email: me.email,
          phone: me.phone,
          isActive: true,
          emailVerified: true,
          phoneVerified: true,
        });
        setActiveMembership(me.activeMembership);
        setMemberships(me.memberships || []);

        // Connect socket
        realtimeService.connect().catch((e) => console.warn("Socket connect err:", e));
      }
    } catch {
      await storage.clearAll();
      setToken(null);
      setUser(null);
      setActiveMembership(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (identifier: string, pass: string) => {
    const res = await authService.login(identifier, pass);
    setToken(res.accessToken);
    setUser(res.user);
    setActiveMembership(res.activeMembership);
    setMemberships(res.memberships || []);
    realtimeService.connect().catch((e) => console.warn("Socket connect err:", e));
  };

  const signup = async (data: SignupInput) => {
    const res = await authService.signup(data);
    setToken(res.accessToken);
    setUser(res.user);
    setActiveMembership(res.activeMembership);
    setMemberships(res.memberships || []);
    realtimeService.connect().catch((e) => console.warn("Socket connect err:", e));
  };

  const logout = async () => {
    await authService.logout();
    realtimeService.disconnect();
    setToken(null);
    setUser(null);
    setActiveMembership(null);
    setMemberships([]);
  };

  const switchRole = async (targetRole: "BUYER" | "SUPPLIER") => {
    const targetMembership = memberships.find((m) => m.role === targetRole);
    if (!targetMembership) {
      throw new Error(`You do not have a ${targetRole} membership profile.`);
    }
    const res = await authService.switchContext(targetMembership.organizationId, targetRole);
    setToken(res.accessToken);
    setActiveMembership(res.activeMembership);
  };

  const refreshUser = async () => {
    try {
      const me = await authService.me();
      if (me) {
        setUser({
          id: me.id,
          fullName: me.fullName,
          email: me.email,
          phone: me.phone,
          isActive: true,
          emailVerified: true,
          phoneVerified: true,
        });
        setActiveMembership(me.activeMembership);
        setMemberships(me.memberships || []);
      }
    } catch (e) {
      console.warn("Refresh user error:", e);
    }
  };

  const currentRole = activeMembership?.role || "BUYER";
  const isBuyer = currentRole === "BUYER";
  const isSupplier = currentRole === "SUPPLIER";
  const isAdmin = currentRole === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        user,
        activeMembership,
        memberships,
        token,
        isLoading,
        isBuyer,
        isSupplier,
        isAdmin,
        login,
        signup,
        logout,
        switchRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

