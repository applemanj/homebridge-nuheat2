"use strict";

class FakeCharacteristic {
  constructor(name) {
    this.name = name;
    this.value = undefined;
    this.handlers = new Map();
  }

  setProps() {
    return this;
  }

  on(event, handler) {
    this.handlers.set(event, handler);
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

function createThermostatHomebridgeStub() {
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

function createSwitchHomebridgeStub() {
  const Characteristic = {
    Manufacturer: "Manufacturer",
    Model: "Model",
    SerialNumber: "SerialNumber",
    On: "On",
  };

  return {
    Characteristic,
    accessory: new FakeAccessory(),
    homebridge: {
      hap: {
        Characteristic,
        Service: {
          Switch: "Switch",
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
    warn() {},
  };
}

module.exports = {
  FakeAccessory,
  FakeCharacteristic,
  FakeService,
  createLogStub,
  createSwitchHomebridgeStub,
  createThermostatHomebridgeStub,
};
