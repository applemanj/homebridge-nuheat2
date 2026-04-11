const test = require("node:test");
const assert = require("node:assert/strict");

const NuHeatScheduleSwitch = require("../lib/NuHeatScheduleSwitch");
const { SCHEDULE_MODE } = require("../lib/NuHeatModels");

function createHomebridgeStub() {
  const Characteristic = {
    Manufacturer: "Manufacturer",
    Model: "Model",
    SerialNumber: "SerialNumber",
    On: "On",
  };

  class FakeCharacteristic {
    constructor(name) {
      this.name = name;
      this.value = undefined;
      this.handlers = new Map();
    }

    on(event, handler) {
      this.handlers.set(event, handler);
      return this;
    }

    updateValue(value) {
      this.value = value;
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
  };
}

test("schedule switch reflects schedule mode state", () => {
  const { accessory, homebridge, Characteristic } = createHomebridgeStub();
  const scheduleSwitch = new NuHeatScheduleSwitch(
    createLogStub(),
    { serialNumber: "123", name: "Bathroom", scheduleMode: SCHEDULE_MODE.HOLD },
    accessory,
    { resumeSchedule: async () => false },
    homebridge,
  );

  scheduleSwitch.updateValues({
    serialNumber: "123",
    name: "Bathroom",
    scheduleMode: SCHEDULE_MODE.AUTO,
  });

  const value = accessory
    .getService(homebridge.hap.Service.Switch)
    .getCharacteristic(Characteristic.On).value;

  assert.equal(value, true);
});

test("schedule switch resumes schedule when turned on", async () => {
  const { accessory, homebridge, Characteristic } = createHomebridgeStub();
  let calledWith = null;
  const scheduleSwitch = new NuHeatScheduleSwitch(
    createLogStub(),
    { serialNumber: "123", name: "Bathroom", scheduleMode: SCHEDULE_MODE.HOLD },
    accessory,
    {
      resumeSchedule: async (serialNumber) => {
        calledWith = serialNumber;
        return {
          serialNumber,
          name: "Bathroom",
          scheduleMode: SCHEDULE_MODE.AUTO,
        };
      },
    },
    homebridge,
  );

  await new Promise((resolve, reject) => {
    scheduleSwitch.setScheduleEnabled(true, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const value = accessory
    .getService(homebridge.hap.Service.Switch)
    .getCharacteristic(Characteristic.On).value;

  assert.equal(calledWith, "123");
  assert.equal(value, true);
});
