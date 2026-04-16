import test = require("node:test");
import assert = require("node:assert/strict");

import NuHeatScheduleSwitch = require("../lib/NuHeatScheduleSwitch");
import { SCHEDULE_MODE } from "../lib/NuHeatModels";
import {
  createLogStub,
  createSwitchHomebridgeStub,
} from "./support/helpers";

test("schedule switch reflects schedule mode state", () => {
  const { accessory, homebridge, Characteristic } = createSwitchHomebridgeStub();
  const scheduleSwitch = new NuHeatScheduleSwitch(
    createLogStub(),
    { serialNumber: "123", name: "Bathroom", scheduleMode: SCHEDULE_MODE.HOLD },
    accessory,
    { resumeSchedule: async () => false } as any,
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
  const { accessory, homebridge, Characteristic } = createSwitchHomebridgeStub();
  let calledWith: string | null = null;
  const scheduleSwitch = new NuHeatScheduleSwitch(
    createLogStub(),
    { serialNumber: "123", name: "Bathroom", scheduleMode: SCHEDULE_MODE.HOLD },
    accessory,
    {
      resumeSchedule: async (serialNumber: string) => {
        calledWith = serialNumber;
        return {
          serialNumber,
          name: "Bathroom",
          scheduleMode: SCHEDULE_MODE.AUTO,
        };
      },
    } as any,
    homebridge,
  );

  await new Promise<void>((resolve, reject) => {
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
