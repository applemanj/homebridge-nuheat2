"use strict";
const fetchModule = require("node-fetch-cjs");
const htmlParser = require("node-html-parser");
const fetch = fetchModule.default;
const FetchError = fetchModule.FetchError;
const HeadersCtor = fetchModule.Headers;
const isRedirect = fetchModule.isRedirect;
const { parse } = htmlParser;
const settings_1 = require("./settings");
const NuHeatModels_1 = require("./NuHeatModels");
class NuHeatAPI {
    email;
    password;
    log;
    oauthClientId;
    oauthClientSecret;
    oauthRedirectUri;
    usingFallbackCredentials;
    headers;
    accessToken;
    accessTokenTimestamp;
    refreshInterval;
    refreshToken;
    tokenScope;
    tokenType;
    constructor(email, password, log, options = {}) {
        this.email = email;
        this.password = password;
        this.log = log;
        this.oauthClientId =
            options.clientId ||
                process.env.NUHEAT_API_CLIENT_ID ||
                settings_1.NUHEAT_API_CLIENT_ID;
        this.oauthClientSecret =
            options.clientSecret ||
                process.env.NUHEAT_API_CLIENT_SECRET ||
                settings_1.NUHEAT_API_CLIENT_SECRET;
        this.oauthRedirectUri =
            options.redirectUri ||
                process.env.NUHEAT_API_REDIRECT_URI ||
                settings_1.NUHEAT_API_REDIRECT_URI;
        this.usingFallbackCredentials =
            !options.clientId &&
                !process.env.NUHEAT_API_CLIENT_ID &&
                !options.clientSecret &&
                !process.env.NUHEAT_API_CLIENT_SECRET;
        this.headers = new HeadersCtor();
        this.headers.set("Content-Type", "application/json");
        this.headers.set("Accept", "application/json");
        this.accessToken = null;
        this.accessTokenTimestamp = 0;
        this.refreshInterval = 0;
        this.refreshToken = "";
        this.tokenScope = "";
        this.tokenType = "Bearer";
        if (this.usingFallbackCredentials) {
            this.log.warn("NuHeatAPI: Using built-in OAuth client credentials. Request your own Nuheat API client for long-term reliability.");
        }
    }
    async setAwayMode(groupId, awayMode) {
        const callURL = "https://api.mynuheat.com/api/v1/Group";
        const callOptions = {
            body: JSON.stringify({
                groupId,
                awayMode,
            }),
            method: "PUT",
        };
        return await this.makeAPICall(callURL, callOptions);
    }
    async setHeatSetpoint(serialNumber, setPointTemp, holdLength) {
        let scheduleMode;
        let holdSetPointDateTime;
        if (holdLength >= 1440) {
            scheduleMode = NuHeatModels_1.SCHEDULE_MODE.PERMANENT_HOLD;
        }
        else if (holdLength > 0) {
            scheduleMode = NuHeatModels_1.SCHEDULE_MODE.HOLD;
            holdSetPointDateTime =
                new Date(Date.now() + holdLength * 60 * 1000)
                    .toISOString()
                    .split(".")[0]
                    .toString() + "Z";
        }
        else {
            scheduleMode = NuHeatModels_1.SCHEDULE_MODE.AUTO;
        }
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat";
        const callBody = {
            serialNumber,
            setPointTemp,
            scheduleMode,
        };
        if (holdSetPointDateTime) {
            callBody.holdSetPointDateTime = holdSetPointDateTime;
        }
        this.log.info(JSON.stringify(callBody));
        const callOptions = {
            body: JSON.stringify(callBody),
            method: "PUT",
        };
        return await this.makeAPICall(callURL, callOptions);
    }
    async resumeSchedule(serialNumber) {
        return this.updateThermostat({
            serialNumber,
            scheduleMode: NuHeatModels_1.SCHEDULE_MODE.AUTO,
        });
    }
    async updateThermostat(thermostatUpdate) {
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat";
        const callOptions = {
            body: JSON.stringify(thermostatUpdate),
            method: "PUT",
        };
        return await this.makeAPICall(callURL, callOptions, {
            normalize: NuHeatModels_1.normalizeThermostat,
        });
    }
    async refreshGroup(groupId) {
        const callURL = "https://api.mynuheat.com/api/v1/Group/" + groupId;
        return await this.makeAPICall(callURL, {}, { normalize: NuHeatModels_1.normalizeGroup });
    }
    async refreshGroups() {
        const callURL = "https://api.mynuheat.com/api/v1/Group";
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeGroup,
            normalizeArray: true,
        });
    }
    async refreshThermostat(serialNumber) {
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat/" + serialNumber;
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeThermostat,
        });
    }
    async refreshThermostats() {
        const callURL = "https://api.mynuheat.com/api/v1/Thermostat";
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeThermostat,
            normalizeArray: true,
        });
    }
    async getAccount() {
        const callURL = "https://api.mynuheat.com/api/v1/Account";
        return await this.makeAPICall(callURL, {}, { normalize: NuHeatModels_1.normalizeAccount });
    }
    async refreshSchedule(serialNumber) {
        const callURL = "https://api.mynuheat.com/api/v1/Schedule/" + serialNumber;
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeSchedule,
        });
    }
    async refreshSchedules() {
        const callURL = "https://api.mynuheat.com/api/v1/Schedule";
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeSchedule,
            normalizeArray: true,
        });
    }
    async updateSchedule(scheduleModel) {
        const callURL = "https://api.mynuheat.com/api/v1/Schedule";
        return await this.makeAPICall(callURL, {
            body: JSON.stringify(scheduleModel),
            method: "PUT",
        }, {
            treatNoContentAsSuccess: true,
        });
    }
    async refreshEnergyLogDay(serialNumber, date) {
        const callURL = "https://api.mynuheat.com/api/v1/EnergyLog/Day/" +
            serialNumber +
            "/" +
            date;
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeEnergyUsage,
        });
    }
    async refreshEnergyLogWeek(serialNumber, date) {
        const callURL = "https://api.mynuheat.com/api/v1/EnergyLog/Week/" +
            serialNumber +
            "/" +
            date;
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeEnergyUsage,
        });
    }
    async refreshEnergyLogMonth(serialNumber, year) {
        const callURL = "https://api.mynuheat.com/api/v1/EnergyLog/Month/" +
            serialNumber +
            "/" +
            year;
        return await this.makeAPICall(callURL, {}, {
            normalize: NuHeatModels_1.normalizeEnergyUsage,
        });
    }
    async makeAPICall(callURL, callOptions = {}, options = {}) {
        if (!(await this.refreshAccessToken())) {
            return false;
        }
        const response = await this.fetch(callURL, callOptions);
        if (!response) {
            this.log.debug("NuHeatAPI: Unable to make API call. Acquiring a new access token.");
            this.accessToken = null;
            return false;
        }
        if (response.status === 204) {
            return true;
        }
        const returnedData = await response.json();
        if (options.normalize) {
            if (options.normalizeArray && Array.isArray(returnedData)) {
                return returnedData.map(options.normalize);
            }
            return options.normalize(returnedData);
        }
        return returnedData;
    }
    describeRequest(url, options = {}) {
        return (options.method || "GET") + " " + url;
    }
    async readResponseBody(response) {
        try {
            const responseText = await response.text();
            if (!responseText) {
                return "";
            }
            return responseText.replace(/\s+/g, " ").trim().slice(0, 300);
        }
        catch {
            return "";
        }
    }
    async oauthGetAuthPage() {
        const authEndpoint = new URL(settings_1.NUHEAT_API_AUTHORIZE_URI);
        authEndpoint.searchParams.set("response_type", "code");
        authEndpoint.searchParams.set("client_id", this.oauthClientId);
        authEndpoint.searchParams.set("redirect_uri", this.oauthRedirectUri);
        authEndpoint.searchParams.set("scope", "openapi openid offline_access");
        const response = await this.fetch(authEndpoint.toString(), {
            redirect: "follow",
        });
        if (!response) {
            this.log.error("NuHeatAPI: Unable to access the OAuth authorization endpoint.");
            return null;
        }
        return response;
    }
    async oauthLogin(authPage) {
        const cookie = this.trimSetCookie(authPage.headers.raw?.()["set-cookie"]);
        if (cookie) {
            const htmlText = await authPage.text();
            const loginPageHtml = parse(htmlText);
            const requestVerificationToken = loginPageHtml
                .querySelector("input[name=__RequestVerificationToken]")
                ?.getAttribute("value") || "";
            const requestReturnURL = loginPageHtml
                .querySelector("input[name=ReturnUrl]")
                ?.getAttribute("value") || "";
            if (!requestVerificationToken) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. The verification token could not be retrieved.");
                return null;
            }
            const loginBody = new URLSearchParams({
                ReturnUrl: requestReturnURL,
                Username: this.email,
                Password: this.password,
                button: "login",
                __RequestVerificationToken: requestVerificationToken,
            });
            const response = await this.fetch(authPage.url, {
                body: loginBody.toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: cookie,
                },
                method: "POST",
                redirect: "manual",
            });
            if (!response) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. Ensure your username and password are correct.");
                return null;
            }
            if (response.headers &&
                response.headers.raw?.()["set-cookie"] &&
                response.headers.raw?.()["set-cookie"].length < 2) {
                this.log.error("NuHeatAPI: Invalid NuHeat credentials given. Check your login and password.");
                return null;
            }
            return response;
        }
        return null;
    }
    async oauthConfirm(authPage, sessionCookie) {
        const redirectUrl = new URL(authPage.headers.get("location") || "", authPage.url);
        const confirmPage = await this.fetch(redirectUrl.toString(), {
            headers: {
                Cookie: sessionCookie,
            },
        });
        if (!confirmPage) {
            this.log.error("NuHeatAPI: Unable to complete the OAuth login redirect.");
            return null;
        }
        const cookie = this.trimSetCookie(confirmPage.headers.raw?.()["set-cookie"]);
        if (cookie) {
            const htmlText = await confirmPage.text();
            const loginPageHtml = parse(htmlText);
            const requestVerificationToken = loginPageHtml
                .querySelector("input[name=__RequestVerificationToken]")
                ?.getAttribute("value") || "";
            const requestReturnURL = loginPageHtml
                .querySelector("input[name=ReturnUrl]")
                ?.getAttribute("value") || "";
            if (!requestVerificationToken) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. The api access couldn't be confirmed.");
                return null;
            }
            const loginBody = new URLSearchParams({
                ReturnUrl: requestReturnURL,
                button: "yes",
                RememberConsent: "true",
                __RequestVerificationToken: requestVerificationToken,
            });
            const response = await this.fetch(settings_1.NUHEAT_API_CONSENT_URI, {
                body: loginBody.toString() +
                    "&ScopesConsented=openid&ScopesConsented=openapi&ScopesConsented=offline_access",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: cookie + "; " + sessionCookie,
                },
                method: "POST",
                redirect: "manual",
            });
            if (!response) {
                this.log.error("NuHeatAPI: Unable to complete OAuth login. API access confirmation not completed.");
                return null;
            }
            return response;
        }
        return null;
    }
    async oauthRedirect(loginResponse, sessionCookie) {
        const redirectUrl = new URL(loginResponse.headers.get("location") || "", settings_1.NUHEAT_API_AUTHORIZE_URI);
        const cookie = this.trimSetCookie(loginResponse.headers.raw?.()["set-cookie"]);
        if (cookie) {
            const response = await this.fetch(redirectUrl.toString(), {
                headers: {
                    Cookie: cookie + "; " + sessionCookie,
                },
                redirect: "manual",
            });
            if (!response) {
                this.log.error("NuHeatAPI: Unable to complete the OAuth login redirect.");
                return null;
            }
            return response;
        }
        return null;
    }
    async getAccessToken() {
        let response = await this.oauthGetAuthPage();
        if (!response) {
            return null;
        }
        response = await this.oauthLogin(response);
        if (!response) {
            return null;
        }
        const sessionCookie = this.trimSetCookie(response.headers.raw?.()["set-cookie"]);
        if (sessionCookie) {
            if (response.headers &&
                (response.headers.get("location") || "").startsWith("/connect/authorize/callback?")) {
                response = await this.oauthConfirm(response, sessionCookie);
                if (!response) {
                    return null;
                }
            }
            response = await this.oauthRedirect(response, sessionCookie);
            if (!response) {
                return null;
            }
            const redirectUrl = new URL(response.headers.get("location") || "");
            const requestBody = new URLSearchParams({
                client_id: this.oauthClientId,
                client_secret: this.oauthClientSecret,
                code: redirectUrl.searchParams.get("code") || "",
                grant_type: "authorization_code",
                redirect_uri: this.oauthRedirectUri,
                scope: redirectUrl.searchParams.get("scope") || "",
            });
            response = await this.fetch(settings_1.NUHEAT_API_TOKEN_URI, {
                body: requestBody.toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method: "POST",
            });
            if (!response) {
                this.log.error("NuHeatAPI: Unable to acquire an OAuth access token.");
                return null;
            }
            this.tokenScope = redirectUrl.searchParams.get("scope") ?? "";
            return (await response.json());
        }
        return null;
    }
    async getRefreshedAccessToken() {
        const requestBody = new URLSearchParams({
            client_id: this.oauthClientId,
            client_secret: this.oauthClientSecret,
            grant_type: "refresh_token",
            redirect_uri: this.oauthRedirectUri,
            refresh_token: this.refreshToken,
            scope: this.tokenScope,
        });
        const response = await this.fetch(settings_1.NUHEAT_API_TOKEN_URI, {
            body: requestBody.toString(),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
        });
        if (!response) {
            return false;
        }
        const token = (await response.json());
        this.accessToken = token.access_token;
        this.accessTokenTimestamp = Date.now();
        this.refreshInterval = token.expires_in;
        this.refreshToken = token.refresh_token;
        this.tokenScope = token.scope ?? this.tokenScope;
        this.tokenType = token.token_type;
        this.refreshInterval -= 420;
        if (this.refreshInterval < 300) {
            this.refreshInterval = 300;
        }
        this.headers.set("Authorization", token.token_type + " " + token.access_token);
        this.log.debug("NuHeatAPI: Successfully refreshed the NuHeat API access token.");
        return true;
    }
    async returnAccessToken() {
        if (this.accessToken) {
            if (Date.now() - this.accessTokenTimestamp > this.refreshInterval * 1000 &&
                Date.now() - this.accessTokenTimestamp < 1000 * 60 * 60 * 24 * 13.5) {
                await this.getRefreshedAccessToken();
            }
        }
        else {
            await this.acquireAccessToken();
        }
        if (this.accessToken) {
            this.headers.set("Authorization", this.tokenType + " " + this.accessToken);
            return this.accessToken;
        }
        else {
            return false;
        }
    }
    async acquireAccessToken() {
        let firstConnection = true;
        if (this.accessToken) {
            firstConnection = false;
            this.accessToken = null;
        }
        const token = await this.getAccessToken();
        if (!token) {
            return false;
        }
        if (firstConnection) {
            this.log.info("NuHeatAPI: Successfully connected to the NuHeat API.");
        }
        else {
            this.log.debug("NuHeatAPI: Successfully reacquired a NuHeat API access token.");
        }
        this.accessToken = token.access_token;
        this.accessTokenTimestamp = Date.now();
        this.tokenType = token.token_type;
        this.refreshInterval = token.expires_in;
        this.refreshToken = token.refresh_token;
        this.tokenScope = token.scope ?? this.tokenScope;
        this.headers.set("Authorization", this.tokenType + " " + this.accessToken);
        return true;
    }
    async refreshAccessToken() {
        if (!this.accessToken) {
            this.log.debug("NuHeatAPI: Acquiring new access token. Ours seems to be missing");
            return await this.acquireAccessToken();
        }
        if (Date.now() - this.accessTokenTimestamp < this.refreshInterval * 1000) {
            return true;
        }
        this.log.debug("NuHeatAPI: Acquiring new access token. Ours has expired or is expiring soon");
        if (await this.getRefreshedAccessToken()) {
            return true;
        }
        this.log.error("NuHeatAPI: Unable to refresh our access token. " +
            "This error can usually be safely ignored and will be resolved by acquiring a new access token.");
        if (!(await this.acquireAccessToken())) {
            this.log.error("NuHeatAPI: Fatal error. We need a new access token didnt successfuly get one");
            return false;
        }
        return true;
    }
    async fetch(url, options = {}, decodeResponse = true, isRetry = false) {
        if (!options.headers) {
            options.headers = this.headers;
        }
        const requestDescription = this.describeRequest(url, options);
        try {
            const response = await fetch(url, options);
            if (!decodeResponse) {
                return response;
            }
            if (response.status === 400) {
                const responseBody = await this.readResponseBody(response);
                this.log.error("NuHeatAPI: " +
                    requestDescription +
                    " failed with 400 Bad Request." +
                    (responseBody ? " Response body: " + responseBody : ""));
                return null;
            }
            else if (response.status === 401) {
                this.log.error("NuHeatAPI: " +
                    requestDescription +
                    " failed with 401 Unauthorized. Check your NuHeat credentials.");
                return null;
            }
            else if (response.status === 500) {
                const responseBody = await this.readResponseBody(response);
                this.log.error("NuHeatAPI: " +
                    requestDescription +
                    " failed with 500 Internal Server Error." +
                    (responseBody ? " Response body: " + responseBody : ""));
                if (isRetry) {
                    return null;
                }
                else {
                    this.log.error("NuHeatAPI: Trying again.");
                    return this.fetch(url, options, decodeResponse, true);
                }
            }
            if (!response.ok && !isRedirect(response.status)) {
                const responseBody = await this.readResponseBody(response);
                this.log.error("NuHeatAPI: " +
                    requestDescription +
                    " failed with " +
                    response.status +
                    " " +
                    response.statusText +
                    "." +
                    (responseBody ? " Response body: " + responseBody : ""));
                return null;
            }
            return response;
        }
        catch (error) {
            if (error instanceof FetchError) {
                switch (error.code) {
                    case "ECONNREFUSED":
                        this.log.error("NuHeatAPI: Connection refused.");
                        break;
                    case "ECONNRESET":
                        if (!isRetry) {
                            this.log.debug("NuHeatAPI: Connection reset during " +
                                requestDescription +
                                ". Retrying the API action.");
                            return this.fetch(url, options, decodeResponse, true);
                        }
                        this.log.error("NuHeatAPI: Connection reset during " + requestDescription + ".");
                        break;
                    case "ENOTFOUND":
                        this.log.error("NuHeatAPI: Hostname or IP address not found.");
                        break;
                    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
                        this.log.error("NuHeatAPI: Unable to verify the NuHeat TLS security certificate.");
                        break;
                    default:
                        this.log.error("NuHeatAPI: " +
                            requestDescription +
                            " failed: " +
                            error.message);
                }
            }
            else {
                this.log.error("NuHeatAPI: " + requestDescription + " failed with error: " + error);
            }
            return null;
        }
    }
    trimSetCookie(setCookie) {
        if (setCookie) {
            return setCookie.map((x) => x.split(";")[0]).join("; ");
        }
        else {
            return false;
        }
    }
}
module.exports = NuHeatAPI;
