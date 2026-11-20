import * as SecureStore from 'expo-secure-store';
import { apiPost } from './api';

export type Membership = {
  organizationId: string;
  role: 'BUYER' | 'SUPPLIER' | 'ADMIN' | string;
  organization?: { id?: string; name?: string };
};

export type AuthResponse = {
  accessToken: string;
  user: { id: string; fullName: string; email?: string | null; phone?: string | null };
  activeMembership: Membership | null;
  memberships: Membership[];
  requiresOnboarding?: boolean;
  message?: string;
};

async function persistSession(result: AuthResponse) {
  if (!result?.accessToken) throw new Error('The server did not return an access token. Please try again.');
  await SecureStore.setItemAsync('sg_token', result.accessToken);
  await SecureStore.setItemAsync('sg_user', JSON.stringify(result.user));
  if (result.activeMembership) {
    await SecureStore.setItemAsync('sg_membership', JSON.stringify(result.activeMembership));
  } else {
    await SecureStore.deleteItemAsync('sg_membership');
  }
  return result;
}

export async function login(identifier: string, password: string) {
  const result = await apiPost<AuthResponse>('/auth/login', { identifier, password });
  return persistSession(result);
}

export async function googleLogin(credential: string) {
  const result = await apiPost<AuthResponse>('/auth/google', { credential });
  return persistSession(result);
}

export async function completeGoogleOnboarding(payload: {
  organizationName: string;
  accountType: 'BUYER' | 'SUPPLIER';
  city?: string;
  taxId?: string;
  description?: string;
  categories?: string[];
  businessType?: string;
}) {
  const result = await apiPost<{ accessToken: string; activeMembership: Membership }>(
    '/auth/google/onboarding',
    payload,
  );
  if (!result?.accessToken || !result.activeMembership) {
    throw new Error('The server did not complete organization setup. Please try again.');
  }
  await SecureStore.setItemAsync('sg_token', result.accessToken);
  await SecureStore.setItemAsync('sg_membership', JSON.stringify(result.activeMembership));
  return result;
}

export type SignupPayload = {
  fullName: string;
  organizationName: string;
  accountType: 'BUYER' | 'SUPPLIER' | 'BOTH';
  email: string;
  phone: string;
  password: string;
  gstNumber?: string;
  establishmentYear?: number;
  factoryLocation?: string;
  serviceableRegions?: string;
  capabilities?: string[];
  keyProcesses?: string[];
  monthlyCapacity?: string;
  moq?: string;
};

export async function signup(payload: SignupPayload) {
  const result = await apiPost<AuthResponse>('/auth/signup', payload);
  return persistSession(result);
}

export async function requestPasswordReset(identifier: string) {
  return apiPost<{ message: string }>('/auth/forgot-password', { identifier });
}

export async function saveRememberedIdentifier(identifier: string | null) {
  if (identifier) await SecureStore.setItemAsync('sg_remembered_identifier', identifier);
  else await SecureStore.deleteItemAsync('sg_remembered_identifier');
}

export async function getRememberedIdentifier() {
  return SecureStore.getItemAsync('sg_remembered_identifier');
}

export async function saveRememberMePreference(enabled: boolean) {
  await SecureStore.setItemAsync('sg_remember_me', enabled ? 'true' : 'false');
}

export async function getRememberMePreference() {
  const value = await SecureStore.getItemAsync('sg_remember_me');
  return value === null ? true : value === 'true';
}