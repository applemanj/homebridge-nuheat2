"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const NuHeatAPI = require("../lib/NuHeatAPI");
const settings_1 = require("../lib/settings");
const helpers_1 = require("./support/helpers");
function withCleanNuheatEnv(callback) {
    const originalClientId = process.env.NUHEAT_API_CLIENT_ID;
    const originalClientSecret = process.env.NUHEAT_API_CLIENT_SECRET;
    const originalRedirectUri = process.env.NUHEAT_API_REDIRECT_URI;
    delete process.env.NUHEAT_API_CLIENT_ID;
    delete process.env.NUHEAT_API_CLIENT_SECRET;
    delete process.env.NUHEAT_API_REDIRECT_URI;
    try {
        return callback();
    }
    finally {
        restoreEnv("NUHEAT_API_CLIENT_ID", originalClientId);
        restoreEnv("NUHEAT_API_CLIENT_SECRET", originalClientSecret);
        restoreEnv("NUHEAT_API_REDIRECT_URI", originalRedirectUri);
    }
}
function restoreEnv(key, value) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}
function createResponse({ status = 200, url = settings_1.NUHEAT_API_AUTHORIZE_URI, location = null, setCookie = [], text = "", } = {}) {
    return {
        status,
        ok: status >= 200 && status < 300,
        statusText: status >= 200 && status < 300 ? "OK" : "Error",
        headers: {
            raw() {
                return {
                    "set-cookie": setCookie,
                };
            },
            get(name) {
                return name.toLowerCase() === "location" ? location : null;
            },
        },
        url,
        async json() {
            return {};
        },
        async text() {
            return text;
        },
    };
}
(0, node_test_1.default)("default OAuth client uses Nuheat PKCE public client", () => {
    withCleanNuheatEnv(() => {
        const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)());
        strict_1.default.equal(api.oauthClientId, "homebridge-nuheat2_260421");
        strict_1.default.equal(api.oauthClientSecret, "");
        strict_1.default.equal(api.usePkce, true);
        strict_1.default.equal(api.usingBuiltInClient, true);
    });
});
(0, node_test_1.default)("default Nuheat endpoints use the Conductor NAM hosts", () => {
    strict_1.default.equal(settings_1.NUHEAT_API_AUTHORIZE_URI, settings_1.NUHEAT_IDENTITY_BASE_URL + "/connect/authorize");
    strict_1.default.equal((0, settings_1.buildNuHeatApiUrl)("/api/v1/Thermostat"), (process.env.NUHEAT_API_BASE_URL || "https://api.nam.mynuheat.com")
        .replace(/\/+$/, "") + "/api/v1/Thermostat");
    strict_1.default.equal(settings_1.NUHEAT_NOTIFICATION_HUB_URL, (process.env.NUHEAT_API_BASE_URL || "https://api.nam.mynuheat.com")
        .replace(/\/+$/, "") + "/v2/notificationsHost");
});
(0, node_test_1.default)("built-in public client ignores stale secrets without custom client ID", () => {
    withCleanNuheatEnv(() => {
        const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)(), {
            clientSecret: "stale-secret",
        });
        strict_1.default.equal(api.oauthClientId, "homebridge-nuheat2_260421");
        strict_1.default.equal(api.oauthClientSecret, "");
        strict_1.default.equal(api.usePkce, true);
    });
});
(0, node_test_1.default)("explicit built-in public client ID still uses PKCE and ignores stale secrets", () => {
    withCleanNuheatEnv(() => {
        const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)(), {
            clientId: "homebridge-nuheat2_260421",
            clientSecret: "stale-secret",
        });
        strict_1.default.equal(api.oauthClientId, "homebridge-nuheat2_260421");
        strict_1.default.equal(api.oauthClientSecret, "");
        strict_1.default.equal(api.usePkce, true);
        strict_1.default.equal(api.usingBuiltInClient, true);
    });
});
(0, node_test_1.default)("PKCE code challenge follows the S256 base64url transform", () => {
    const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)(), {
        clientId: "public-client",
    });
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    strict_1.default.equal(api.getPkceCodeChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
(0, node_test_1.default)("authorization request includes PKCE challenge for public clients", async () => {
    await withCleanNuheatEnv(async () => {
        const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)(), {
            clientId: "public-client",
        });
        api.generatePkceCodeVerifier = () => "test-code-verifier";
        let requestedUrl = "";
        api.fetch = async (url) => {
            requestedUrl = url;
            return {
                status: 200,
                ok: true,
                statusText: "OK",
                headers: {
                    get() {
                        return null;
                    },
                },
                url,
                async json() {
                    return {};
                },
                async text() {
                    return "";
                },
            };
        };
        await api.oauthGetAuthPage();
        const authorizationUrl = new URL(requestedUrl);
        strict_1.default.equal(authorizationUrl.origin, settings_1.NUHEAT_IDENTITY_BASE_URL);
        strict_1.default.equal(authorizationUrl.searchParams.get("client_id"), "public-client");
        strict_1.default.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
        strict_1.default.equal(authorizationUrl.searchParams.get("code_challenge"), api.getPkceCodeChallenge("test-code-verifier"));
    });
});
(0, node_test_1.default)("authorization code token request uses verifier without client secret for PKCE", () => {
    const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)(), {
        clientId: "public-client",
    });
    api.pkceCodeVerifier = "test-code-verifier";
    const requestBody = api.buildAuthorizationCodeTokenRequest(new URL("http://localhost?code=abc123&scope=openapi%20offline_access"));
    strict_1.default.equal(requestBody.get("client_id"), "public-client");
    strict_1.default.equal(requestBody.get("grant_type"), "authorization_code");
    strict_1.default.equal(requestBody.get("code"), "abc123");
    strict_1.default.equal(requestBody.get("code_verifier"), "test-code-verifier");
    strict_1.default.equal(requestBody.has("client_secret"), false);
});
(0, node_test_1.default)("legacy confidential clients include client secret and skip PKCE verifier", () => {
    const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)(), {
        clientId: "legacy-client",
        clientSecret: "legacy-secret",
    });
    api.refreshToken = "refresh-token";
    api.tokenScope = "openapi offline_access";
    const authorizationBody = api.buildAuthorizationCodeTokenRequest(new URL("http://localhost?code=abc123&scope=openapi%20offline_access"));
    const refreshBody = api.buildRefreshTokenRequest();
    strict_1.default.equal(api.usePkce, false);
    strict_1.default.equal(authorizationBody.get("client_secret"), "legacy-secret");
    strict_1.default.equal(authorizationBody.has("code_verifier"), false);
    strict_1.default.equal(refreshBody.get("client_secret"), "legacy-secret");
    strict_1.default.equal(refreshBody.get("refresh_token"), "refresh-token");
});
(0, node_test_1.default)("OAuth login posts the Nuheat identity login form fields", async () => {
    const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)());
    const authPage = createResponse({
        url: "https://identity.nam.mynuheat.com/Account/Login?ReturnUrl=test",
        setCookie: ["anti-forgery=one; path=/"],
        text: `
      <form action="/Culture/SetCulture">
        <input name="__RequestVerificationToken" value="culture-token">
      </form>
      <form method="post">
        <input type="hidden" name="ReturnUrl" value="/connect/authorize/callback">
        <input type="text" name="Email">
        <input type="password" name="Password">
        <input type="hidden" name="__RequestVerificationToken" value="login-token">
      </form>
    `,
    });
    let requestedUrl = "";
    let requestBody = "";
    api.fetch = async (url, options) => {
        requestedUrl = url;
        requestBody = options.body;
        return createResponse({
            setCookie: ["session=one; path=/", "auth=two; path=/"],
        });
    };
    await api.oauthLogin(authPage);
    const postedForm = new URLSearchParams(requestBody);
    strict_1.default.equal(requestedUrl, authPage.url);
    strict_1.default.equal(postedForm.get("Email"), "user@example.com");
    strict_1.default.equal(postedForm.has("Username"), false);
    strict_1.default.equal(postedForm.get("__RequestVerificationToken"), "login-token");
    strict_1.default.equal(postedForm.get("ReturnUrl"), "/connect/authorize/callback");
});
(0, node_test_1.default)("OAuth consent follows Nuheat HTML browser redirects with consent cookies", async () => {
    const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)());
    const authResponse = createResponse({
        location: "https://identity.nam.mynuheat.com/consent?returnUrl=test",
    });
    const calls = [];
    api.fetch = async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) {
            return createResponse({
                url,
                setCookie: ["consent=one; path=/"],
                text: `
          <form action="/Culture/SetCulture"></form>
          <form action="/Consent" method="post">
            <input type="hidden" name="ReturnUrl" value="/connect/authorize/callback">
            <input type="checkbox" name="ScopesConsented" value="openid" checked>
            <input type="checkbox" name="ScopesConsented" value="profile" checked>
            <input type="checkbox" name="ScopesConsented" value="openapi" checked>
            <input type="checkbox" name="ScopesConsented" value="offline_access" checked>
            <input type="hidden" name="__RequestVerificationToken" value="consent-token">
            <button name="button" value="yes">Yes, Allow</button>
          </form>
        `,
            });
        }
        if (calls.length === 2) {
            return createResponse({
                url,
                setCookie: ["grant=one; path=/"],
                text: `
          <meta http-equiv="refresh" content="0;url=/connect/authorize/callback?state=done">
        `,
            });
        }
        return createResponse({
            status: 302,
            url,
            location: "http://localhost?code=abc123&scope=openid%20profile%20openapi%20offline_access",
        });
    };
    const result = await api.oauthConfirm(authResponse, "session=one");
    strict_1.default.equal(result?.headers.get("location"), "http://localhost?code=abc123&scope=openid%20profile%20openapi%20offline_access");
    strict_1.default.equal(calls[1].url, "https://identity.nam.mynuheat.com/Consent");
    const consentBody = new URLSearchParams(calls[1].options.body);
    strict_1.default.equal(consentBody.get("__RequestVerificationToken"), "consent-token");
    strict_1.default.deepEqual(consentBody.getAll("ScopesConsented"), [
        "openid",
        "profile",
        "openapi",
        "offline_access",
    ]);
    strict_1.default.match(calls[2].options.headers.Cookie, /session=one/);
    strict_1.default.match(calls[2].options.headers.Cookie, /consent=one/);
    strict_1.default.match(calls[2].options.headers.Cookie, /grant=one/);
});
