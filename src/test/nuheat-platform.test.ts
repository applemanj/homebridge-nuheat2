import test = require("node:test");
import assert = require("node:assert/strict");

import registerPlatform = require("../index");
import NuHeatAwaySwitch = require("../lib/NuHeatAwaySwitch");
import NuHeatGroup = require("../lib/NuHeatGroup");
import { toNuHeatTemperature } from "../lib/NuHeatModels";
import {
  FakeAccessory,
  createLogStub,
  createSwitchHomebridgeStub,
} from "./support/helpers";

class PlatformAccessoryStub extends FakeAccessory {
  UUID: string;

  constructor(_name: string, uuid: string) {
    super();
    this.UUID = uuid;
  }
}

function createPlatform(config: Record<string, unknown>) {
  let PlatformConstructor: any;
  const registeredAccessories: PlatformAccessoryStub[] = [];
  const warnings: string[] = [];
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
        generate(value: string) {
          return value;
        },
      },
    },
    platformAccessory: PlatformAccessoryStub,
    registerPlatform(
      _pluginName: string,
      _platformName: string,
      constructor: any,
    ) {
      PlatformConstructor = constructor;
    },
  };
  registerPlatform(homebridge as any);

  const platform = new PlatformConstructor(
    {
      info() {},
      warn(message: string) {
        warnings.push(message);
      },
      error() {},
      debug() {},
    },
    {
      email: "user@example.com",
      password: "password",
      ...config,
    },
    {
      on() {},
      registerPlatformAccessories(
        _pluginName: string,
        _platformName: string,
        accessories: PlatformAccessoryStub[],
      ) {
        registeredAccessories.push(...accessories);
      },
      unregisterPlatformAccessories() {},
    },
  );

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
  assert.ok(
    String(warnings[0]).includes("Hold Length"),
    "expected a warning about the refused hold length",
  );
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

  assert.deepEqual(
    registeredAccessories.map((accessory) => accessory.UUID).sort(),
    ["group-away", "group-upstairs"],
  );
});

test("group allow-list still filters switches when all-groups is disabled", async () => {
  const { platform, registeredAccessories } = createPlatform({
    autoPopulateAwayModeSwitches: false,
    groups: [{ groupName: "Away" }],
  });

  await platform.setupGroups();

  assert.deepEqual(
    registeredAccessories.map((accessory) => accessory.UUID),
    ["group-away"],
  );
});

test("failed away-mode writes acknowledge HomeKit and reconcile from the API", async () => {
  const { accessory, homebridge, Characteristic } =
    createSwitchHomebridgeStub();
  const group = new NuHeatGroup(
    createLogStub(),
    { groupId: "group-away", groupName: "Away", awayMode: true },
    accessory,
    {
      async setAwayMode() {
        return false;
      },
      async refreshGroup() {
        return { groupId: "group-away", groupName: "Away", awayMode: false };
      },
    } as any,
    homebridge,
  );

  let callbackError: unknown = "unset";
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
  const { accessory, homebridge, Characteristic } =
    createSwitchHomebridgeStub();
  const writes: Array<{ setPointTemp: string; holdLength: number }> = [];
  const awaySwitch = new NuHeatAwaySwitch(
    createLogStub(),
    { serialNumber: "SN1", name: "Bathroom" },
    accessory,
    {
      async setHeatSetpoint(_serial: string, setPointTemp: string, holdLength: number) {
        writes.push({ setPointTemp, holdLength });
        return true;
      },
      async resumeSchedule() {
        return { scheduleMode: 1, setPointTemp: Number(toNuHeatTemperature(20)) };
      },
      async refreshThermostat() {
        return {
          scheduleMode: 3,
          setPointTemp: Number(toNuHeatTemperature(10)),
        };
      },
    } as any,
    homebridge,
    10, // away setpoint in Celsius
  );

  let callbackError: unknown = "unset";
  await awaySwitch.setAwayEnabled(true, (error) => {
    callbackError = error ?? null;
  });

  assert.equal(callbackError, null);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].holdLength, 1440);
  assert.equal(writes[0].setPointTemp, toNuHeatTemperature(10));

  const switchValue = accessory
    .getService(homebridge.hap.Service.Switch)
    .getCharacteristic(Characteristic.On).value;
  assert.equal(switchValue, true);
});

test("away switch OFF resumes the schedule", async () => {
  const { accessory, homebridge, Characteristic } =
    createSwitchHomebridgeStub();
  let resumeCalls = 0;
  const awaySwitch = new NuHeatAwaySwitch(
    createLogStub(),
    { serialNumber: "SN1", name: "Bathroom" },
    accessory,
    {
      async setHeatSetpoint() {
        throw new Error("should not be called");
      },
      async resumeSchedule() {
        resumeCalls += 1;
        return { scheduleMode: 1, setPointTemp: Number(toNuHeatTemperature(20)) };
      },
      async refreshThermostat() {
        throw new Error("should not be called");
      },
    } as any,
    homebridge,
    10,
  );

  let callbackError: unknown = "unset";
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
  const { accessory, homebridge, Characteristic } =
    createSwitchHomebridgeStub();
  const awaySwitch = new NuHeatAwaySwitch(
    createLogStub(),
    { serialNumber: "SN1", name: "Bathroom" },
    accessory,
    {} as any,
    homebridge,
    10,
  );

  awaySwitch.updateValues({
    scheduleMode: 3,
    setPointTemp: Number(toNuHeatTemperature(10)),
  });
  assert.equal(
    accessory
      .getService(homebridge.hap.Service.Switch)
      .getCharacteristic(Characteristic.On).value,
    true,
  );

  // A timed hold at the same setpoint is NOT away.
  awaySwitch.updateValues({
    scheduleMode: 2,
    setPointTemp: Number(toNuHeatTemperature(10)),
  });
  assert.equal(
    accessory
      .getService(homebridge.hap.Service.Switch)
      .getCharacteristic(Characteristic.On).value,
    false,
  );

  // A permanent hold at a different setpoint (e.g. user's manual change) is
  // not the away state either.
  awaySwitch.updateValues({
    scheduleMode: 3,
    setPointTemp: Number(toNuHeatTemperature(22)),
  });
  assert.equal(
    accessory
      .getService(homebridge.hap.Service.Switch)
      .getCharacteristic(Characteristic.On).value,
    false,
  );
});

