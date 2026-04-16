import test = require("node:test");
import assert = require("node:assert/strict");

import NuHeatThermostat = require("../lib/NuHeatThermostat");
import {
  createLogStub,
  createThermostatHomebridgeStub,
} from "./support/helpers";

test("manual mode is exposed to HomeKit as heat, not off", () => {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "123", swVersion: "1.0", name: "Bathroom" },
    1440,
    accessory,
    {} as any,
    homebridge,
  );

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
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "456", swVersion: "1.0", name: "Ensuite" },
    1440,
    accessory,
    {} as any,
    homebridge,
  );

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
