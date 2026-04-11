const test = require("node:test");
const assert = require("node:assert/strict");

const NuHeatScheduleSwitch = require("../lib/NuHeatScheduleSwitch");
const { SCHEDULE_MODE } = require("../lib/NuHeatModels");
const {
  createLogStub,
  createSwitchHomebridgeStub,
} = require("./support/helpers");

test("schedule switch reflects schedule mode state", () => {
  const { accessory, homebridge, Characteristic } = createSwitchHomebridgeStub();
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
  const { accessory, homebridge, Characteristic } = createSwitchHomebridgeStub();
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
