"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const NuHeatThermostat = require("../lib/NuHeatThermostat");
const helpers_1 = require("./support/helpers");
test("manual mode is exposed to HomeKit as heat, not off", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "123", swVersion: "1.0", name: "Bathroom" }, 1440, accessory, {}, homebridge);
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: false,
        operatingMode: 2,
    });
    const value = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState).value;
    assert.equal(value, Characteristic.TargetHeatingCoolingState.HEAT);
});
test("string online values are parsed without mutating the payload", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "456", swVersion: "1.0", name: "Ensuite" }, 1440, accessory, {}, homebridge);
    const payload = {
        Online: "'True'",
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: true,
        operatingMode: 1,
    };
    thermostat.updateValues(payload);
    const currentState = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState).value;
    assert.equal(currentState, 1);
    assert.equal(payload.Online, "'True'");
});
