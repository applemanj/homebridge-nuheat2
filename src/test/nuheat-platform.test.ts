import test = require("node:test");
import assert = require("node:assert/strict");

import registerPlatform = require("../index");
import NuHeatGroup = require("../lib/NuHeatGroup");
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

test("explicit holdLength of 0 is refused with a warning instead of silently becoming 1440 via falsy coercion", async () => {
  const { platform, warnings } = createPlatform({ holdLength: 0 });
  assert.equal(platform.config.holdLength, 1440);
  assert.equal(warnings.length, 1);
  assert.ok(
    String(warnings[0]).includes("Hold Length"),
    "expected a warning about the ignored hold length",
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
