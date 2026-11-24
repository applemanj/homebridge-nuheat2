"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const registerPlatform = require("../index");
const NuHeatAwaySwitch = require("../lib/NuHeatAwaySwitch");
const NuHeatGroup = require("../lib/NuHeatGroup");
const NuHeatModels_1 = require("../lib/NuHeatModels");
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
    const warnings = [];
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
    const platform = new PlatformConstructor({
        info() { },
        warn(message) {
            warnings.push(message);
        },
        error() { },
        debug() { },
    }, {
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
    return { platform, registeredAccessories, warnings };
}
test("explicit holdLength of 0 passes through as the hold-until-schedule value", async () => {
    const { platform, warnings } = createPlatform({ holdLength: 0 });
    assert.equal(platform.config.holdLength, 0);
    assert.equal(warnings.length, 0);
});
test("negative holdLength is refused with a warning", async () => {
    const { platform, warnings } = createPlatform({ holdLength: -5 });
    assert.equal(platform.config.holdLength, 1440);
    assert.equal(warnings.length, 1);
    assert.ok(String(warnings[0]).includes("Hold Length"), "expected a warning about the refused hold length");
});
test("holdLength values above 1440 are clamped to 1440", async () => {
    const { platform, warnings } = createPlatform({ holdLength: 5000 });
    assert.equal(platform.config.holdLength, 1440);
    assert.equal(warnings.length, 0);
});
test("unset holdLength keeps the 1440 default", async () => {
    const { platform, warnings } = createPlatform({});
    assert.equal(platform.config.holdLength, 1440);
    assert.equal(warnings.length, 0);
});
test("valid holdLength passes through unchanged", async () => {
    const { platform, warnings } = createPlatform({ holdLength: 180 });
    assert.equal(platform.config.holdLength, 180);
    assert.equal(warnings.length, 0);
});
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
test("failed away-mode writes acknowledge HomeKit and reconcile from the API", async () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createSwitchHomebridgeStub)();
    const group = new NuHeatGroup((0, helpers_1.createLogStub)(), { groupId: "group-away", groupName: "Away", awayMode: true }, accessory, {
        async setAwayMode() {
            return false;
        },
        async refreshGroup() {
            return { groupId: "group-away", groupName: "Away", awayMode: false };
        },
    }, homebridge);
    let callbackError = "unset";
    await group.setAwayMode(true, (error) => {
        callbackError = error ?? null;
    });
    assert.equal(callbackError, null);
    const switchValue = accessory
        .getService(homebridge.hap.Service.Switch)
        .getCharacteristic(Characteristic.On).value;
    assert.equal(switchValue, false);
});
test("away switch ON writes a permanent hold at the configured away setpoint", async () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createSwitchHomebridgeStub)();
    const writes = [];
    const awaySwitch = new NuHeatAwaySwitch((0, helpers_1.createLogStub)(), { serialNumber: "SN1", name: "Bathroom" }, accessory, {
        async setHeatSetpoint(_serial, setPointTemp, holdLength) {
            writes.push({ setPointTemp, holdLength });
            return true;
        },
        async resumeSchedule() {
            return { scheduleMode: 1, setPointTemp: Number((0, NuHeatModels_1.toNuHeatTemperature)(20)) };
        },
        async refreshThermostat() {
            return {
                scheduleMode: 3,
                setPointTemp: Number((0, NuHeatModels_1.toNuHeatTemperature)(10)),
            };
        },
    }, homebridge, 10);
    let callbackError = "unset";
    await awaySwitch.setAwayEnabled(true, (error) => {
        callbackError = error ?? null;
    });
    assert.equal(callbackError, null);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].holdLength, 1440);
    assert.equal(writes[0].setPointTemp, (0, NuHeatModels_1.toNuHeatTemperature)(10));
    const switchValue = accessory
        .getService(homebridge.hap.Service.Switch)
        .getCharacteristic(Characteristic.On).value;
    assert.equal(switchValue, true);
});
test("away switch OFF resumes the schedule", async () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createSwitchHomebridgeStub)();
    let resumeCalls = 0;
    const awaySwitch = new NuHeatAwaySwitch((0, helpers_1.createLogStub)(), { serialNumber: "SN1", name: "Bathroom" }, accessory, {
        async setHeatSetpoint() {
            throw new Error("should not be called");
        },
        async resumeSchedule() {
            resumeCalls += 1;
            return { scheduleMode: 1, setPointTemp: Number((0, NuHeatModels_1.toNuHeatTemperature)(20)) };
        },
        async refreshThermostat() {
            throw new Error("should not be called");
        },
    }, homebridge, 10);
    let callbackError = "unset";
    await awaySwitch.setAwayEnabled(false, (error) => {
        callbackError = error ?? null;
    });
    assert.equal(callbackError, null);
    assert.equal(resumeCalls, 1);
    const switchValue = accessory
        .getService(homebridge.hap.Service.Switch)
        .getCharacteristic(Characteristic.On).value;
    assert.equal(switchValue, false);
});
test("away switch reports ON only for a permanent hold at the away setpoint", async () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createSwitchHomebridgeStub)();
    const awaySwitch = new NuHeatAwaySwitch((0, helpers_1.createLogStub)(), { serialNumber: "SN1", name: "Bathroom" }, accessory, {}, homebridge, 10);
    awaySwitch.updateValues({
        scheduleMode: 3,
        setPointTemp: Number((0, NuHeatModels_1.toNuHeatTemperature)(10)),
    });
    assert.equal(accessory
        .getService(homebridge.hap.Service.Switch)
        .getCharacteristic(Characteristic.On).value, true);
    // A timed hold at the same setpoint is NOT away.
    awaySwitch.updateValues({
        scheduleMode: 2,
        setPointTemp: Number((0, NuHeatModels_1.toNuHeatTemperature)(10)),
    });
    assert.equal(accessory
        .getService(homebridge.hap.Service.Switch)
        .getCharacteristic(Characteristic.On).value, false);
    // A permanent hold at a different setpoint (e.g. user's manual change) is
    // not the away state either.
    awaySwitch.updateValues({
        scheduleMode: 3,
        setPointTemp: Number((0, NuHeatModels_1.toNuHeatTemperature)(22)),
    });
    assert.equal(accessory
        .getService(homebridge.hap.Service.Switch)
        .getCharacteristic(Characteristic.On).value, false);
});
