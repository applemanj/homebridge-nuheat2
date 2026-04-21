class FakeCharacteristic {
  name: string;
  value: unknown;
  handlers: Map<string, (...args: unknown[]) => unknown>;
  props: Record<string, unknown>;

  constructor(name: string) {
    this.name = name;
    this.value = undefined;
    this.handlers = new Map();
    this.props = {};
  }

  setProps(props: Record<string, unknown>): this {
    this.props = { ...this.props, ...props };
    return this;
  }

  on(event: string, handler: (...args: unknown[]) => unknown): this {
    this.handlers.set(event, handler);
    return this;
  }

  updateValue(value: unknown): this {
    this.value = value;
    return this;
  }

  setCharacteristic(): this {
    return this;
  }
}

class FakeService {
  characteristics: Map<string, FakeCharacteristic>;

  constructor() {
    this.characteristics = new Map();
  }

  getCharacteristic(name: unknown): FakeCharacteristic {
    const key = String(name);
    if (!this.characteristics.has(key)) {
      this.characteristics.set(key, new FakeCharacteristic(key));
    }

    return this.characteristics.get(key)!;
  }

  setCharacteristic(name: unknown, value: unknown): this {
    this.getCharacteristic(name).value = value;
    return this;
  }
}

class FakeAccessory {
  services: Map<string, FakeService>;

  constructor() {
    this.services = new Map();
  }

  getService(name: unknown): FakeService {
    const key = String(name);
    if (!this.services.has(key)) {
      this.services.set(key, new FakeService());
    }

    return this.services.get(key)!;
  }

  addService(name: unknown): FakeService {
    return this.getService(name);
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
    CurrentHeatingCoolingState: {
      OFF: 0,
      HEAT: 1,
      COOL: 2,
    },
    TargetHeatingCoolingState: {
      OFF: 0,
      HEAT: 1,
      COOL: 2,
      AUTO: 3,
    },
    TemperatureDisplayUnits: {
      CELSIUS: 0,
      FAHRENHEIT: 1,
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
        uuid: {
          generate(value: string) {
            return value;
          },
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
        uuid: {
          generate(value: string) {
            return value;
          },
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

export {
  FakeAccessory,
  FakeCharacteristic,
  FakeService,
  createLogStub,
  createSwitchHomebridgeStub,
  createThermostatHomebridgeStub,
};
