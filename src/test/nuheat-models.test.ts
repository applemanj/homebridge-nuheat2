import test = require("node:test");
import assert = require("node:assert/strict");

import {
  HEATING_MODE,
  deriveHeatingMode,
  fromNuHeatTemperature,
  isStandbySetpoint,
  normalizeAccount,
  normalizeEnergyUsage,
  normalizeGroup,
  normalizeSchedule,
  normalizeThermostat,
  SCHEDULE_MODE,
} from "../lib/NuHeatModels";

test("normalizeThermostat maps Swagger PascalCase payloads to internal camelCase", () => {
  const thermostat = normalizeThermostat({
    SerialNumber: "ABC123",
    Name: "Primary Bath",
    SetPointTemp: 1209,
    ScheduleMode: 2,
    HoldSetPointDateTime: "2026-04-11T08:15:00Z",
    GroupId: 7,
    SwVersion: "1.2.3",
    Online: true,
    OperatingMode: 2,
    IsHeating: true,
    CurrentTemperature: 1181,
    TZOffset: "-05:00",
    Error: null,
  });

  assert.deepEqual(thermostat, {
    serialNumber: "ABC123",
    name: "Primary Bath",
    setPointTemp: 1209,
    scheduleMode: 2,
    holdSetPointDateTime: "2026-04-11T08:15:00Z",
    groupId: 7,
    swVersion: "1.2.3",
    online: true,
    operatingMode: 2,
    isHeating: true,
    currentTemperature: 1181,
    tzOffset: "-05:00",
    error: undefined,
  });
});

test("normalizeGroup preserves current string group IDs", () => {
  assert.deepEqual(
    normalizeGroup({
      GroupId: "group-away",
      GroupName: "Away",
      AwayMode: false,
      AwaySetPointTemp: 850,
    }),
    {
      groupId: "group-away",
      groupName: "Away",
      awayMode: false,
      awaySetPointTemp: 850,
    },
  );
});

test("normalizeSchedule maps nested schedule data", () => {
  const schedule = normalizeSchedule({
    SerialNumber: "ABC123",
    Days: [
      {
        WeekDay: 1,
        WeekDayGroupNumber: 1,
        Events: [
          {
            Clock: "06:00",
            ScheduleType: 0,
            Active: true,
            Temperature: 1209,
          },
        ],
      },
    ],
  });

  assert.equal(schedule.serialNumber, "ABC123");
  assert.equal(schedule.days[0]?.weekDay, 1);
  assert.equal(schedule.days[0]?.events[0]?.clock, "06:00");
});

test("normalizeAccount and normalizeEnergyUsage return public helper shapes", () => {
  const account = normalizeAccount({
    FirstName: "Josh",
    LastName: "Appleman",
    Email: "example@example.com",
    Use12Hour: true,
    TemperatureScale: "Fahrenheit",
  });
  const energyUsage = normalizeEnergyUsage({
    EnergyUsageType: 1,
    EnergyUsageFrom: "2026-04-10",
    EnergyUsageTo: "2026-04-10",
    MondayIsFirstDay: true,
    EnergyUsage: [{ Entry: "1", Minutes: 45 }],
  });

  assert.equal(account.temperatureScale, "Fahrenheit");
  assert.equal(energyUsage.energyUsage[0]?.minutes, 45);
});

test("schedule mode constants expose documented Swagger values", () => {
  assert.equal(SCHEDULE_MODE.AUTO, 1);
  assert.equal(SCHEDULE_MODE.HOLD, 2);
  assert.equal(SCHEDULE_MODE.PERMANENT_HOLD, 3);
});

test("deriveHeatingMode reports standby as off via the minimum setpoint", () => {
  // The plugin requests standby as a manual mode at 10 C (raw 985), which is
  // how a v2 off write reads back through the v1 API.
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 3,
      setPointTemp: 985,
      operatingMode: 2,
    }),
    HEATING_MODE.OFF,
  );

  // A timed hold parked at the minimum setpoint is standby too.
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 2,
      setPointTemp: 985,
      operatingMode: 2,
    }),
    HEATING_MODE.OFF,
  );

  // Away mode reads back below the standby setpoint.
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 3,
      setPointTemp: 850,
      operatingMode: 2,
    }),
    HEATING_MODE.OFF,
  );
});

test("deriveHeatingMode reports warm manual and hold setpoints as heat", () => {
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 3,
      setPointTemp: 2346,
      operatingMode: 2,
    }),
    HEATING_MODE.MANUAL,
  );
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 2,
      setPointTemp: 1209,
      operatingMode: 2,
    }),
    HEATING_MODE.HOLD,
  );
});

test("deriveHeatingMode treats auto schedules as auto regardless of operating mode", () => {
  // Nuheat reports operatingMode 2 (manual) while an auto schedule runs;
  // that is a scheduled run, not standby.
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 1,
      setPointTemp: 1209,
      operatingMode: 2,
    }),
    HEATING_MODE.AUTO,
  );
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 1,
      setPointTemp: 1209,
      operatingMode: 1,
    }),
    HEATING_MODE.AUTO,
  );
});

test("deriveHeatingMode handles unknown schedule modes and missing setpoints", () => {
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 99,
      setPointTemp: 985,
      operatingMode: 2,
    }),
    HEATING_MODE.OFF,
  );
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 99,
      setPointTemp: 1209,
      operatingMode: 2,
    }),
    HEATING_MODE.MANUAL,
  );
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 99,
      setPointTemp: 1209,
      operatingMode: 1,
    }),
    HEATING_MODE.AUTO,
  );
  // A missing setpoint cannot be identified as standby.
  assert.equal(
    deriveHeatingMode({
      online: true,
      scheduleMode: 3,
      operatingMode: 2,
    }),
    HEATING_MODE.MANUAL,
  );
});

test("deriveHeatingMode reports offline thermostats as off", () => {
  assert.equal(
    deriveHeatingMode({
      online: false,
      scheduleMode: 3,
      setPointTemp: 985,
    }),
    HEATING_MODE.OFF,
  );
});

test("temperature helpers decode the Nuheat raw encoding", () => {
  assert.equal(fromNuHeatTemperature(985), 10);
  assert.equal(fromNuHeatTemperature(2497), 25);
  assert.equal(isStandbySetpoint(985), true);
  assert.equal(isStandbySetpoint(850), true);
  assert.equal(isStandbySetpoint(1209), false);
  assert.equal(isStandbySetpoint(undefined), false);
  assert.equal(isStandbySetpoint(null), false);
});
