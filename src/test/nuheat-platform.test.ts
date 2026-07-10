import test = require("node:test");
import assert = require("node:assert/strict");

import registerPlatform = require("../index");
import { FakeAccessory } from "./support/helpers";

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
    { info() {}, warn() {}, error() {}, debug() {} },
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

  return { platform, registeredAccessories };
}

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
