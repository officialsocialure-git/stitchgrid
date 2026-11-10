import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TOKEN_KEY = "stitchguard_jwt_token";
const USER_KEY = "stitchguard_user_data";
const ORG_KEY = "stitchguard_active_org";

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return await AsyncStorage.getItem(TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn("Storage setToken error:", e);
    }
  },

  async removeToken(): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (e) {
      console.warn("Storage removeToken error:", e);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage setItem error:", e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage removeItem error:", e);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await this.removeToken();
      await AsyncStorage.multiRemove([USER_KEY, ORG_KEY]);
    } catch (e) {
      console.warn("Storage clearAll error:", e);
    }
  },
};

