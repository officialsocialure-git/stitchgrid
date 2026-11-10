import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../constants/config";
import { storage } from "../utils/storage";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await storage.removeToken();
    }
    return Promise.reject(error);
  }
);

export async function uploadBase64File(filename: string, base64Data: string, label?: string): Promise<{ url: string; filename: string }> {
  const cleanData = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const res = await api.post("/upload", {
    filename,
    data: cleanData,
    label: label || "Mobile Upload",
  });
  return res.data?.data || res.data;
}

