import crypto from "crypto";
import { env } from "../config/env";

type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

function credentials() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend environment.");
  }
  return { keyId: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET };
}

export async function createRazorpayOrder(amountRupees: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder> {
  const { keyId, secret } = credentials();
  const amount = Math.round(amountRupees * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid payment amount.");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount, currency: "INR", receipt: receipt.slice(0, 40), notes })
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data?.error?.description || "Unable to create Razorpay order.");
  return data as RazorpayOrder;
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { secret } = credentials();
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!rawBody || !signature || !env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function fetchRazorpayPayment(paymentId: string) {
  const { keyId, secret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64") }
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data?.error?.description || "Unable to verify Razorpay payment status.");
  return data as { id: string; order_id: string; amount: number; currency: string; status: string; method?: string };
}

export async function createRazorpayRefund(paymentId: string, amountRupees: number, notes: Record<string, string>) {
  const { keyId, secret } = credentials();
  const amount = Math.round(amountRupees * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid refund amount.");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount, notes })
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data?.error?.description || "Unable to create Razorpay refund.");
  return data as { id: string; status: string; amount: number };
}

export function getRazorpayPublicKey() {
  return env.RAZORPAY_KEY_ID || null;
}

export function isRazorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}
