"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPERATURE_TYPE = exports.HEATING_MODE = exports.OPERATING_MODE = exports.SCHEDULE_MODE = void 0;
exports.isThermostatOnline = isThermostatOnline;
exports.deriveHeatingMode = deriveHeatingMode;
exports.normalizeAccount = normalizeAccount;
exports.normalizeGroup = normalizeGroup;
exports.normalizeSchedule = normalizeSchedule;
exports.normalizeThermostat = normalizeThermostat;
exports.normalizeEnergyUsage = normalizeEnergyUsage;
exports.SCHEDULE_MODE = {
    AUTO: 1,
    HOLD: 2,
    PERMANENT_HOLD: 3,
};
exports.OPERATING_MODE = {
    AUTO: 1,
    MANUAL: 2,
};
exports.HEATING_MODE = {
    OFF: "off",
    MANUAL: "manual",
    HOLD: "hold",
    AUTO: "auto",
};
/** v2 `eTemperatureType`: 0 = absolute setpoint, 1 = relative to current. */
exports.TEMPERATURE_TYPE = {
    ABSOLUTE: 0,
    RELATIVE: 1,
};
function coalesce(...values) {
    return values.find((value) => value !== undefined && value !== null);
}
function isThermostatOnline(thermostat) {
    const onlineValue = coalesce(thermostat.Online, thermostat.online, thermostat.isOnline);
    if (typeof onlineValue === "boolean") {
        return onlineValue;
    }
    if (typeof onlineValue === "string") {
        return onlineValue.replace(/'/g, "").trim().toLowerCase() === "true";
    }
    return true;
}
/**
 * NuHeat has no "off". Standby is reported as operating mode MANUAL paired
 * with schedule mode AUTO; a real manual setpoint change always sends a hold
 * schedule mode.
 */
function deriveHeatingMode(thermostat) {
    if (!isThermostatOnline(thermostat)) {
        return exports.HEATING_MODE.OFF;
    }
    const scheduleMode = Number(thermostat.scheduleMode);
    if (scheduleMode === exports.SCHEDULE_MODE.HOLD) {
        return exports.HEATING_MODE.HOLD;
    }
    if (scheduleMode === exports.SCHEDULE_MODE.PERMANENT_HOLD) {
        return exports.HEATING_MODE.MANUAL;
    }
    if (scheduleMode === exports.SCHEDULE_MODE.AUTO) {
        return Number(thermostat.operatingMode) === exports.OPERATING_MODE.MANUAL
            ? exports.HEATING_MODE.OFF
            : exports.HEATING_MODE.AUTO;
    }
    // Unknown schedule mode: report whatever the hardware tells us.
    return Number(thermostat.operatingMode) === exports.OPERATING_MODE.MANUAL
        ? exports.HEATING_MODE.MANUAL
        : exports.HEATING_MODE.AUTO;
}
function normalizeAccount(account = {}) {
    return {
        firstName: coalesce(account.firstName, account.FirstName),
        lastName: coalesce(account.lastName, account.LastName),
        email: coalesce(account.email, account.Email),
        use12Hour: coalesce(account.use12Hour, account.Use12Hour),
        temperatureScale: coalesce(account.temperatureScale, account.TemperatureScale),
    };
}
function normalizeGroup(group = {}) {
    return {
        groupId: coalesce(group.groupId, group.GroupId),
        groupName: coalesce(group.groupName, group.GroupName),
        awayMode: coalesce(group.awayMode, group.AwayMode),
        awaySetPointTemp: coalesce(group.awaySetPointTemp, group.AwaySetPointTemp),
    };
}
function normalizeScheduleEvent(event = {}) {
    return {
        clock: coalesce(event.clock, event.Clock),
        scheduleType: coalesce(event.scheduleType, event.ScheduleType),
        active: coalesce(event.active, event.Active),
        temperature: coalesce(event.temperature, event.Temperature),
    };
}
function normalizeScheduleDay(day = {}) {
    return {
        weekDay: coalesce(day.weekDay, day.WeekDay),
        weekDayGroupNumber: coalesce(day.weekDayGroupNumber, day.WeekDayGroupNumber),
        events: (coalesce(day.events, day.Events) || []).map(normalizeScheduleEvent),
    };
}
function normalizeSchedule(schedule = {}) {
    return {
        serialNumber: coalesce(schedule.serialNumber, schedule.SerialNumber),
        days: (coalesce(schedule.days, schedule.Days) || []).map(normalizeScheduleDay),
    };
}
function normalizeThermostat(thermostat = {}) {
    return {
        serialNumber: coalesce(thermostat.serialNumber, thermostat.SerialNumber),
        name: coalesce(thermostat.name, thermostat.Name),
        setPointTemp: coalesce(thermostat.setPointTemp, thermostat.SetPointTemp),
        scheduleMode: coalesce(thermostat.scheduleMode, thermostat.ScheduleMode),
        holdSetPointDateTime: coalesce(thermostat.holdSetPointDateTime, thermostat.HoldSetPointDateTime),
        groupId: coalesce(thermostat.groupId, thermostat.GroupId),
        swVersion: coalesce(thermostat.swVersion, thermostat.SwVersion),
        online: coalesce(thermostat.online, thermostat.Online),
        operatingMode: coalesce(thermostat.operatingMode, thermostat.OperatingMode),
        isHeating: coalesce(thermostat.isHeating, thermostat.IsHeating),
        currentTemperature: coalesce(thermostat.currentTemperature, thermostat.CurrentTemperature),
        tzOffset: coalesce(thermostat.tzOffset, thermostat.TZOffset),
        error: coalesce(thermostat.error, thermostat.Error),
    };
}
function normalizeEnergyUsageEntry(entry = {}) {
    return {
        entry: coalesce(entry.entry, entry.Entry),
        minutes: coalesce(entry.minutes, entry.Minutes),
        energyKWattHour: coalesce(entry.energyKWattHour, entry.EnergyKWattHour),
        chargeKWattHour: coalesce(entry.chargeKWattHour, entry.ChargeKWattHour),
    };
}
function normalizeEnergyUsage(energyUsage = {}) {
    return {
        energyUsageType: coalesce(energyUsage.energyUsageType, energyUsage.EnergyUsageType),
        energyUsageFrom: coalesce(energyUsage.energyUsageFrom, energyUsage.EnergyUsageFrom),
        energyUsageTo: coalesce(energyUsage.energyUsageTo, energyUsage.EnergyUsageTo),
        mondayIsFirstDay: coalesce(energyUsage.mondayIsFirstDay, energyUsage.MondayIsFirstDay),
        energyUsage: (coalesce(energyUsage.energyUsage, energyUsage.EnergyUsage) || []).map(normalizeEnergyUsageEntry),
    };
}
