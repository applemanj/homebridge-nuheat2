"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const NuHeatAPI = require("../lib/NuHeatAPI");
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
(0, node_test_1.default)("default OAuth client uses Nuheat PKCE public client", () => {
    withCleanNuheatEnv(() => {
        const api = new NuHeatAPI("user@example.com", "password", (0, helpers_1.createLogStub)());
        strict_1.default.equal(api.oauthClientId, "homebridge-nuheat2_260421");
        strict_1.default.equal(api.oauthClientSecret, "");
        strict_1.default.equal(api.usePkce, true);
        strict_1.default.equal(api.usingBuiltInClient, true);
    });
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
