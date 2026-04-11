const test = require("node:test");
const assert = require("node:assert/strict");

const NuHeatThermostat = require("../lib/NuHeatThermostat");

function createHomebridgeStub() {
  const Characteristic = {
    Manufacturer: "Manufacturer",
    Model: "Model",
    SerialNumber: "SerialNumber",
    FirmwareRevision: "FirmwareRevision",
    CurrentTemperature: "CurrentTemperature",
    TargetTemperature: "TargetTemperature",
    CurrentHeatingCoolingState: "CurrentHeatingCoolingState",
    TargetHeatingCoolingState: {
      OFF: 0,
      HEAT: 1,
      COOL: 2,
      AUTO: 3,
    },
  };

  class FakeCharacteristic {
    constructor(name) {
      this.name = name;
      this.value = undefined;
    }

    setProps() {
      return this;
    }

    on() {
      return this;
    }

    updateValue(value) {
      this.value = value;
      return this;
    }

    setCharacteristic() {
      return this;
    }
  }

  class FakeService {
    constructor() {
      this.characteristics = new Map();
    }

    getCharacteristic(name) {
      if (!this.characteristics.has(name)) {
        this.characteristics.set(name, new FakeCharacteristic(name));
      }

      return this.characteristics.get(name);
    }

    setCharacteristic(name, value) {
      this.getCharacteristic(name).value = value;
      return this;
    }
  }

  class FakeAccessory {
    constructor() {
      this.services = new Map();
    }

    getService(name) {
      if (!this.services.has(name)) {
        this.services.set(name, new FakeService());
      }

      return this.services.get(name);
    }
  }

  return {
    Characteristic,
    accessory: new FakeAccessory(),
    homebridge: {
      hap: {
        Characteristic,
        Service: {
          Thermostat: "Thermostat",
          AccessoryInformation: "AccessoryInformation",
        },
      },
    },
  };
}

function createLogStub() {
  return {
    info() {},
    debug() {},
    error() {},
  };
}

test("manual mode is exposed to HomeKit as heat, not off", () => {
  const { accessory, homebridge, Characteristic } = createHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "123", swVersion: "1.0", name: "Bathroom" },
    1440,
    accessory,
    {},
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
  const { accessory, homebridge, Characteristic } = createHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "456", swVersion: "1.0", name: "Ensuite" },
    1440,
    accessory,
    {},
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
