/**
 * Authentication logic for Alysis Code Pro using RFC 8628 Device Authorization Flow.
 */

import { setTimeout as delay } from "node:timers/promises";
import type {
  OAuthCredentials,
  OAuthLoginCallbacks,
} from "@earendil-works/pi-ai";
import {
  ANON_KEY,
  getAccountUrl,
  getActivateUrl,
  getDeviceCodeUrl,
  getDeviceTokenUrl,
  getLogoutUrl,
} from "./constants.js";

const DEFAULT_POLL_INTERVAL_S = 5;
const DEFAULT_TIMEOUT_S = 900; // 15 minutes

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url?: string;
  verification_url_complete?: string;
  interval?: number;
  expires_in?: number;
}

interface DeviceTokenResponse {
  status?: string;
  key?: string;
  error?: string | { message?: string };
}

interface DeviceGrant {
  userCode: string;
  deviceCode: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  activateUrl: string;
}

function getFunctionHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

async function requestDeviceGrant(signal?: AbortSignal): Promise<DeviceGrant> {
  const codeResponse = await fetch(getDeviceCodeUrl(), {
    method: "POST",
    headers: getFunctionHeaders(),
    body: JSON.stringify({
      client_name: `pi-agent @ ${process.env.HOSTNAME || "localhost"}`,
    }),
    signal,
  });

  if (!codeResponse.ok) {
    let errorText = "";
    try {
      errorText = await codeResponse.text();
    } catch {
      // Ignore body read errors
    }
    throw new Error(
      `Failed to start authentication flow (${codeResponse.status}): ${errorText || codeResponse.statusText}`,
    );
  }

  const grant = (await codeResponse.json()) as DeviceCodeResponse;
  const userCode = grant.user_code?.trim();
  const deviceCode = grant.device_code?.trim();

  if (!userCode || !deviceCode) {
    throw new Error("Alysis login service did not return a valid device code.");
  }

  return {
    userCode,
    deviceCode,
    intervalSeconds: Math.max(grant.interval ?? DEFAULT_POLL_INTERVAL_S, 1),
    expiresInSeconds: Math.max(grant.expires_in ?? DEFAULT_TIMEOUT_S, 10),
    activateUrl: getActivateUrl(userCode),
  };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  try {
    await delay(ms, undefined, { signal });
  } catch (err: unknown) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new Error("Login cancelled.");
    }
    throw err;
  }
}

async function pollDeviceToken(
  grant: DeviceGrant,
  callbacks: OAuthLoginCallbacks,
  signal?: AbortSignal,
): Promise<string> {
  const deadline = Date.now() + grant.expiresInSeconds * 1000;

  while (Date.now() < deadline) {
    await sleep(grant.intervalSeconds * 1000, signal);

    try {
      const tokenResponse = await fetch(getDeviceTokenUrl(), {
        method: "POST",
        headers: getFunctionHeaders(),
        body: JSON.stringify({ device_code: grant.deviceCode }),
        signal,
      });

      if (!tokenResponse.ok) {
        continue;
      }

      const body = (await tokenResponse.json()) as DeviceTokenResponse;
      const status = (body.status || "").toLowerCase().trim();

      if (status === "approved") {
        const key = body.key?.trim();
        if (!key) {
          throw new Error(
            "Alysis login service indicated approval but returned no gateway key.",
          );
        }
        return key;
      }

      if (status === "denied") {
        throw new Error("Login was rejected on the Alysis website.");
      }

      if (
        status === "expired" ||
        status === "not_found" ||
        status === "already_claimed"
      ) {
        throw new Error(
          "Login code expired or already claimed. Run /login alysis again.",
        );
      }

      const remainingSeconds = Math.max(
        0,
        Math.round((deadline - Date.now()) / 1000),
      );
      callbacks.onProgress?.(
        `Waiting for approval in browser (${remainingSeconds}s remaining)...`,
      );
    } catch (err: unknown) {
      if (
        signal?.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        throw new Error("Login cancelled.");
      }
    }
  }

  throw new Error(
    `Timed out after ${grant.expiresInSeconds}s waiting for approval at ${getAccountUrl()}. Run /login alysis again.`,
  );
}

/**
 * Executes RFC 8628 device code authentication against Alysis Supabase Edge Functions.
 */
export async function loginAlysis(
  callbacks: OAuthLoginCallbacks,
  signal?: AbortSignal,
): Promise<OAuthCredentials> {
  const grant = await requestDeviceGrant(signal);

  callbacks.onDeviceCode({
    userCode: grant.userCode,
    verificationUri: getActivateUrl(),
    intervalSeconds: grant.intervalSeconds,
    expiresInSeconds: grant.expiresInSeconds,
  });

  callbacks.onAuth({ url: grant.activateUrl });
  callbacks.onProgress?.("Waiting for approval in browser...");

  const accessKey = await pollDeviceToken(grant, callbacks, signal);

  return {
    access: accessKey,
    refresh: "",
    expires: Date.now() + 365 * 24 * 3600 * 1000,
  };
}

/**
 * Revokes the session gateway key server-side.
 */
export async function logoutAlysis(
  accessKey: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!accessKey) {
    return false;
  }

  try {
    const res = await fetch(getLogoutUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}
