"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NUHEAT_NOTIFICATION_HUB_URL = exports.NUHEAT_API_CONSENT_URI = exports.NUHEAT_API_TOKEN_URI = exports.NUHEAT_API_AUTHORIZE_URI = exports.NUHEAT_IDENTITY_BASE_URL = exports.NUHEAT_API_BASE_URL = exports.NUHEAT_API_REDIRECT_URI = exports.NUHEAT_API_CLIENT_SECRET = exports.NUHEAT_API_CLIENT_ID = void 0;
exports.buildNuHeatApiUrl = buildNuHeatApiUrl;
exports.NUHEAT_API_CLIENT_ID = "homebridge-nuheat2_260421";
exports.NUHEAT_API_CLIENT_SECRET = "";
exports.NUHEAT_API_REDIRECT_URI = "http://localhost";
const DEFAULT_NUHEAT_API_BASE_URL = "https://api.nam.mynuheat.com";
const DEFAULT_NUHEAT_IDENTITY_BASE_URL = "https://identity.nam.mynuheat.com";
function normalizeBaseUrl(url) {
    return url.replace(/\/+$/, "");
}
exports.NUHEAT_API_BASE_URL = normalizeBaseUrl(process.env.NUHEAT_API_BASE_URL || DEFAULT_NUHEAT_API_BASE_URL);
exports.NUHEAT_IDENTITY_BASE_URL = normalizeBaseUrl(process.env.NUHEAT_IDENTITY_BASE_URL || DEFAULT_NUHEAT_IDENTITY_BASE_URL);
function buildNuHeatApiUrl(path) {
    return exports.NUHEAT_API_BASE_URL + (path.startsWith("/") ? path : "/" + path);
}
exports.NUHEAT_API_AUTHORIZE_URI = exports.NUHEAT_IDENTITY_BASE_URL + "/connect/authorize";
exports.NUHEAT_API_TOKEN_URI = exports.NUHEAT_IDENTITY_BASE_URL + "/connect/token";
exports.NUHEAT_API_CONSENT_URI = exports.NUHEAT_IDENTITY_BASE_URL + "/consent";
exports.NUHEAT_NOTIFICATION_HUB_URL = exports.NUHEAT_API_BASE_URL + "/notificationsHost";
