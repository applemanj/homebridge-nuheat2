export const NUHEAT_API_CLIENT_ID = "homebridge-nuheat2_260421";

export const NUHEAT_API_CLIENT_SECRET = "";

export const NUHEAT_API_REDIRECT_URI = "http://localhost";

const DEFAULT_NUHEAT_API_BASE_URL = "https://api.nam.mynuheat.com";

const DEFAULT_NUHEAT_IDENTITY_BASE_URL = "https://identity.nam.mynuheat.com";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const NUHEAT_API_BASE_URL = normalizeBaseUrl(
  process.env.NUHEAT_API_BASE_URL || DEFAULT_NUHEAT_API_BASE_URL,
);

export const NUHEAT_IDENTITY_BASE_URL = normalizeBaseUrl(
  process.env.NUHEAT_IDENTITY_BASE_URL || DEFAULT_NUHEAT_IDENTITY_BASE_URL,
);

export function buildNuHeatApiUrl(path: string): string {
  return NUHEAT_API_BASE_URL + (path.startsWith("/") ? path : "/" + path);
}

export const NUHEAT_API_AUTHORIZE_URI =
  NUHEAT_IDENTITY_BASE_URL + "/connect/authorize";

export const NUHEAT_API_TOKEN_URI =
  NUHEAT_IDENTITY_BASE_URL + "/connect/token";

export const NUHEAT_API_CONSENT_URI = NUHEAT_IDENTITY_BASE_URL + "/consent";

export const NUHEAT_NOTIFICATION_HUB_URL =
  NUHEAT_API_BASE_URL + "/notificationsHost";
