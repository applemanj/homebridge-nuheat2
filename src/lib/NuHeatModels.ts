export const SCHEDULE_MODE = {
  AUTO: 1,
  HOLD: 2,
  PERMANENT_HOLD: 3,
} as const;

export type ScheduleMode = (typeof SCHEDULE_MODE)[keyof typeof SCHEDULE_MODE];

export const OPERATING_MODE = {
  AUTO: 1,
  MANUAL: 2,
} as const;

export type OperatingMode =
  (typeof OPERATING_MODE)[keyof typeof OPERATING_MODE];

export const HEATING_MODE = {
  OFF: "off",
  MANUAL: "manual",
  HOLD: "hold",
  AUTO: "auto",
} as const;

export type HeatingMode = (typeof HEATING_MODE)[keyof typeof HEATING_MODE];

/** v2 `eTemperatureType`: 0 = absolute setpoint, 1 = relative to current. */
export const TEMPERATURE_TYPE = {
  ABSOLUTE: 0,
  RELATIVE: 1,
} as const;

type Maybe<T> = T | null | undefined;

export interface Account {
  firstName?: string;
  lastName?: string;
  email?: string;
  use12Hour?: boolean;
  temperatureScale?: string;
}

interface AccountInput extends Account {
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Use12Hour?: boolean;
  TemperatureScale?: string;
}

export interface Group {
  groupId?: string | number;
  groupName?: string;
  awayMode?: boolean;
  awaySetPointTemp?: number;
}

interface GroupInput extends Group {
  GroupId?: string | number;
  GroupName?: string;
  AwayMode?: boolean;
  AwaySetPointTemp?: number;
}

export interface ScheduleEvent {
  clock?: string;
  scheduleType?: number;
  active?: boolean;
  temperature?: number;
}

interface ScheduleEventInput extends ScheduleEvent {
  Clock?: string;
  ScheduleType?: number;
  Active?: boolean;
  Temperature?: number;
}

export interface ScheduleDay {
  weekDay?: number;
  weekDayGroupNumber?: number;
  events: ScheduleEvent[];
}

interface ScheduleDayInput {
  weekDay?: number;
  WeekDay?: number;
  weekDayGroupNumber?: number;
  WeekDayGroupNumber?: number;
  events?: ScheduleEventInput[];
  Events?: ScheduleEventInput[];
}

export interface Schedule {
  serialNumber?: string;
  days: ScheduleDay[];
}

interface ScheduleInput {
  serialNumber?: string;
  SerialNumber?: string;
  days?: ScheduleDayInput[];
  Days?: ScheduleDayInput[];
}

export interface Thermostat {
  serialNumber?: string;
  name?: string;
  setPointTemp?: number;
  scheduleMode?: number;
  holdSetPointDateTime?: string;
  groupId?: string | number;
  swVersion?: string;
  online?: boolean | string;
  isOnline?: boolean | string;
  operatingMode?: number;
  isHeating?: boolean;
  currentTemperature?: number;
  tzOffset?: number | string;
  error?: string | null;
}

interface ThermostatInput extends Thermostat {
  SerialNumber?: string;
  Name?: string;
  SetPointTemp?: number;
  ScheduleMode?: number;
  HoldSetPointDateTime?: string;
  GroupId?: string | number;
  SwVersion?: string;
  Online?: boolean | string;
  OperatingMode?: number;
  IsHeating?: boolean;
  CurrentTemperature?: number;
  TZOffset?: number | string;
  Error?: string | null;
  IsOnline?: boolean | string;
}

export interface EnergyUsageEntry {
  entry?: string;
  minutes?: number;
  energyKWattHour?: number;
  chargeKWattHour?: number;
}

interface EnergyUsageEntryInput extends EnergyUsageEntry {
  Entry?: string;
  Minutes?: number;
  EnergyKWattHour?: number;
  ChargeKWattHour?: number;
}

export interface EnergyUsage {
  energyUsageType?: number;
  energyUsageFrom?: string;
  energyUsageTo?: string;
  mondayIsFirstDay?: boolean;
  energyUsage: EnergyUsageEntry[];
}

interface EnergyUsageInput {
  energyUsageType?: number;
  EnergyUsageType?: number;
  energyUsageFrom?: string;
  EnergyUsageFrom?: string;
  energyUsageTo?: string;
  EnergyUsageTo?: string;
  mondayIsFirstDay?: boolean;
  MondayIsFirstDay?: boolean;
  energyUsage?: EnergyUsageEntryInput[];
  EnergyUsage?: EnergyUsageEntryInput[];
}

function coalesce<T>(...values: Array<Maybe<T>>): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

export function isThermostatOnline(thermostat: Thermostat): boolean {
  const onlineValue = coalesce(
    (thermostat as ThermostatInput).Online,
    thermostat.online,
    (thermostat as ThermostatInput).isOnline,
  );

  if (typeof onlineValue === "boolean") {
    return onlineValue;
  }

  if (typeof onlineValue === "string") {
    return onlineValue.replace(/'/g, "").trim().toLowerCase() === "true";
  }

  return true;
}

/** The minimum NuHeat target temperature, which the plugin uses for standby. */
export const STANDBY_SETPOINT_C = 10;

/** Converts a raw NuHeat temperature (e.g. `setPointTemp`) to Celsius. */
export function fromNuHeatTemperature(raw: number): number {
  return (((raw - 33) / 56 + 33 - 32) * 5) / 9;
}

/**
 * Standby is a manual or hold mode parked at the minimum target temperature,
 * which is how this plugin requests it. Away mode reads back even lower, so
 * anything at or below the standby setpoint counts.
 */
export function isStandbySetpoint(setPointTemp?: number | null): boolean {
  if (setPointTemp === undefined || setPointTemp === null) {
    return false;
  }

  const celsius = fromNuHeatTemperature(Number(setPointTemp));
  return Number.isFinite(celsius) && celsius <= STANDBY_SETPOINT_C;
}

/**
 * NuHeat has no "off". Standby is a manual or hold mode parked at the minimum
 * target temperature; a genuine manual setpoint change always reads back
 * warmer, and an auto schedule is a scheduled run regardless of the
 * thermostat's operating mode.
 */
export function deriveHeatingMode(thermostat: Thermostat): HeatingMode {
  if (!isThermostatOnline(thermostat)) {
    return HEATING_MODE.OFF;
  }

  const scheduleMode = Number(thermostat.scheduleMode);

  if (scheduleMode === SCHEDULE_MODE.HOLD) {
    return isStandbySetpoint(thermostat.setPointTemp)
      ? HEATING_MODE.OFF
      : HEATING_MODE.HOLD;
  }

  if (scheduleMode === SCHEDULE_MODE.PERMANENT_HOLD) {
    return isStandbySetpoint(thermostat.setPointTemp)
      ? HEATING_MODE.OFF
      : HEATING_MODE.MANUAL;
  }

  if (scheduleMode === SCHEDULE_MODE.AUTO) {
    return HEATING_MODE.AUTO;
  }

  // Unknown schedule mode: report whatever the hardware tells us.
  if (Number(thermostat.operatingMode) === OPERATING_MODE.MANUAL) {
    return isStandbySetpoint(thermostat.setPointTemp)
      ? HEATING_MODE.OFF
      : HEATING_MODE.MANUAL;
  }

  return HEATING_MODE.AUTO;
}

export function normalizeAccount(account: AccountInput = {}): Account {
  return {
    firstName: coalesce(account.firstName, account.FirstName),
    lastName: coalesce(account.lastName, account.LastName),
    email: coalesce(account.email, account.Email),
    use12Hour: coalesce(account.use12Hour, account.Use12Hour),
    temperatureScale: coalesce(
      account.temperatureScale,
      account.TemperatureScale,
    ),
  };
}

export function normalizeGroup(group: GroupInput = {}): Group {
  return {
    groupId: coalesce(group.groupId, group.GroupId),
    groupName: coalesce(group.groupName, group.GroupName),
    awayMode: coalesce(group.awayMode, group.AwayMode),
    awaySetPointTemp: coalesce(group.awaySetPointTemp, group.AwaySetPointTemp),
  };
}

function normalizeScheduleEvent(event: ScheduleEventInput = {}): ScheduleEvent {
  return {
    clock: coalesce(event.clock, event.Clock),
    scheduleType: coalesce(event.scheduleType, event.ScheduleType),
    active: coalesce(event.active, event.Active),
    temperature: coalesce(event.temperature, event.Temperature),
  };
}

function normalizeScheduleDay(day: ScheduleDayInput = {}): ScheduleDay {
  return {
    weekDay: coalesce(day.weekDay, day.WeekDay),
    weekDayGroupNumber: coalesce(
      day.weekDayGroupNumber,
      day.WeekDayGroupNumber,
    ),
    events: (coalesce(day.events, day.Events) || []).map(
      normalizeScheduleEvent,
    ),
  };
}

export function normalizeSchedule(schedule: ScheduleInput = {}): Schedule {
  return {
    serialNumber: coalesce(schedule.serialNumber, schedule.SerialNumber),
    days: (coalesce(schedule.days, schedule.Days) || []).map(
      normalizeScheduleDay,
    ),
  };
}

export function normalizeThermostat(
  thermostat: ThermostatInput = {},
): Thermostat {
  return {
    serialNumber: coalesce(thermostat.serialNumber, thermostat.SerialNumber),
    name: coalesce(thermostat.name, thermostat.Name),
    setPointTemp: coalesce(thermostat.setPointTemp, thermostat.SetPointTemp),
    scheduleMode: coalesce(thermostat.scheduleMode, thermostat.ScheduleMode),
    holdSetPointDateTime: coalesce(
      thermostat.holdSetPointDateTime,
      thermostat.HoldSetPointDateTime,
    ),
    groupId: coalesce(thermostat.groupId, thermostat.GroupId),
    swVersion: coalesce(thermostat.swVersion, thermostat.SwVersion),
    online: coalesce(thermostat.online, thermostat.Online),
    operatingMode: coalesce(thermostat.operatingMode, thermostat.OperatingMode),
    isHeating: coalesce(thermostat.isHeating, thermostat.IsHeating),
    currentTemperature: coalesce(
      thermostat.currentTemperature,
      thermostat.CurrentTemperature,
    ),
    tzOffset: coalesce(thermostat.tzOffset, thermostat.TZOffset),
    error: coalesce(thermostat.error, thermostat.Error),
  };
}

function normalizeEnergyUsageEntry(
  entry: EnergyUsageEntryInput = {},
): EnergyUsageEntry {
  return {
    entry: coalesce(entry.entry, entry.Entry),
    minutes: coalesce(entry.minutes, entry.Minutes),
    energyKWattHour: coalesce(entry.energyKWattHour, entry.EnergyKWattHour),
    chargeKWattHour: coalesce(entry.chargeKWattHour, entry.ChargeKWattHour),
  };
}

export function normalizeEnergyUsage(
  energyUsage: EnergyUsageInput = {},
): EnergyUsage {
  return {
    energyUsageType: coalesce(
      energyUsage.energyUsageType,
      energyUsage.EnergyUsageType,
    ),
    energyUsageFrom: coalesce(
      energyUsage.energyUsageFrom,
      energyUsage.EnergyUsageFrom,
    ),
    energyUsageTo: coalesce(
      energyUsage.energyUsageTo,
      energyUsage.EnergyUsageTo,
    ),
    mondayIsFirstDay: coalesce(
      energyUsage.mondayIsFirstDay,
      energyUsage.MondayIsFirstDay,
    ),
    energyUsage: (
      coalesce(energyUsage.energyUsage, energyUsage.EnergyUsage) || []
    ).map(normalizeEnergyUsageEntry),
  };
}
