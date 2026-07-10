"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const registerPlatform = require("../index");
const helpers_1 = require("./support/helpers");
class PlatformAccessoryStub extends helpers_1.FakeAccessory {
    UUID;
    constructor(_name, uuid) {
        super();
        this.UUID = uuid;
    }
}
function createPlatform(config) {
    let PlatformConstructor;
    const registeredAccessories = [];
    const homebridge = {
        hap: {
            Characteristic: {
                Manufacturer: "Manufacturer",
                Model: "Model",
                SerialNumber: "SerialNumber",
                Name: "Name",
                On: "On",
            },
            Service: {
                Switch: "Switch",
                AccessoryInformation: "AccessoryInformation",
            },
            uuid: {
                generate(value) {
                    return value;
                },
            },
        },
        platformAccessory: PlatformAccessoryStub,
        registerPlatform(_pluginName, _platformName, constructor) {
            PlatformConstructor = constructor;
        },
    };
    registerPlatform(homebridge);
    const platform = new PlatformConstructor({ info() { }, warn() { }, error() { }, debug() { } }, {
        email: "user@example.com",
        password: "password",
        ...config,
    }, {
        on() { },
        registerPlatformAccessories(_pluginName, _platformName, accessories) {
            registeredAccessories.push(...accessories);
        },
        unregisterPlatformAccessories() { },
    });
    platform.NuHeatAPI = {
        refreshGroups: async () => [
            { groupId: "group-away", groupName: "Away", awayMode: false },
            { groupId: "group-upstairs", groupName: "Upstairs", awayMode: false },
        ],
        setAwayMode: async () => true,
    };
    return { platform, registeredAccessories };
}
test("all-groups option exposes every away switch even with an allow-list", async () => {
    const { platform, registeredAccessories } = createPlatform({
        autoPopulateAwayModeSwitches: true,
        groups: [{ groupName: "Away" }],
    });
    await platform.setupGroups();
    assert.deepEqual(registeredAccessories.map((accessory) => accessory.UUID).sort(), ["group-away", "group-upstairs"]);
});
test("group allow-list still filters switches when all-groups is disabled", async () => {
    const { platform, registeredAccessories } = createPlatform({
        autoPopulateAwayModeSwitches: false,
        groups: [{ groupName: "Away" }],
    });
    await platform.setupGroups();
    assert.deepEqual(registeredAccessories.map((accessory) => accessory.UUID), ["group-away"]);
});
