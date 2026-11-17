import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function getApiBaseUrl(): string {
  const envApi = (process.env.API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!envApi) {
    return getAppBaseUrl();
  }
  if (!envApi.startsWith("http://") && !envApi.startsWith("https://")) {
    return `${getAppBaseUrl()}/${envApi.replace(/^\//, "")}`;
  }
  return envApi;
}
