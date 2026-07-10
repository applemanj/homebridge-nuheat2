"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const NuHeatModels_1 = require("../lib/NuHeatModels");
test("normalizeThermostat maps Swagger PascalCase payloads to internal camelCase", () => {
    const thermostat = (0, NuHeatModels_1.normalizeThermostat)({
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
    assert.deepEqual((0, NuHeatModels_1.normalizeGroup)({
        GroupId: "group-away",
        GroupName: "Away",
        AwayMode: false,
        AwaySetPointTemp: 850,
    }), {
        groupId: "group-away",
        groupName: "Away",
        awayMode: false,
        awaySetPointTemp: 850,
    });
});
test("normalizeSchedule maps nested schedule data", () => {
    const schedule = (0, NuHeatModels_1.normalizeSchedule)({
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
    const account = (0, NuHeatModels_1.normalizeAccount)({
        FirstName: "Josh",
        LastName: "Appleman",
        Email: "example@example.com",
        Use12Hour: true,
        TemperatureScale: "Fahrenheit",
    });
    const energyUsage = (0, NuHeatModels_1.normalizeEnergyUsage)({
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
    assert.equal(NuHeatModels_1.SCHEDULE_MODE.AUTO, 1);
    assert.equal(NuHeatModels_1.SCHEDULE_MODE.HOLD, 2);
    assert.equal(NuHeatModels_1.SCHEDULE_MODE.PERMANENT_HOLD, 3);
});
