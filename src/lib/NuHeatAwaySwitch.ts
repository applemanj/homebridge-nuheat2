import NuHeatAPI = require("./NuHeatAPI");
import { SCHEDULE_MODE, toNuHeatTemperature } from "./NuHeatModels";
import type {
  AccessoryLike,
  AccessoryThermostat,
  Callback,
  HomebridgeLike,
  LoggerLike,
} from "./types";

let Characteristic: Record<string, any>;
let SwitchService: unknown;

/**
 * Per-thermostat away switch. ON parks the thermostat in a permanent hold at
 * the configured away setpoint; OFF resumes the schedule. Unlike the group
 * away-mode switch, the thermostat keeps heating if the away setpoint calls
 * for it, so the room is protected against freezing without turning the
 * thermostat fully off.
 */
class NuHeatAwaySwitch {
  log: LoggerLike;
  deviceData: AccessoryThermostat;
  accessory: AccessoryLike;
  nuHeatAPI: NuHeatAPI;
  awaySetPointTempC: number;

  constructor(
    log: LoggerLike,
    deviceData: AccessoryThermostat,
    accessory: AccessoryLike,
    nuHeatAPI: NuHeatAPI,
    homebridge: HomebridgeLike,
    awaySetPointTempC: number,
  ) {
    Characteristic = homebridge.hap.Characteristic;
    SwitchService = homebridge.hap.Service.Switch;
    this.log = log;
    this.deviceData = deviceData;
    this.accessory = accessory;
    this.nuHeatAPI = nuHeatAPI;
    this.awaySetPointTempC = awaySetPointTempC;

    this.accessory
      .getService(homebridge.hap.Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
      .setCharacteristic(Characteristic.Model, "Signature Away")
      .setCharacteristic(
        Characteristic.SerialNumber,
        (this.deviceData.serialNumber ?? "") + "-away",
      );

    this.setupListeners();
  }

  setupListeners(): void {
    this.accessory
      .getService(SwitchService)
      .getCharacteristic(Characteristic.On)
      .on("set", this.setAwayEnabled.bind(this));
  }

  async setAwayEnabled(value: boolean, callback: Callback): Promise<void> {
    if (!value) {
      this.log.debug(
        "Resuming schedule for thermostat " + this.deviceData.serialNumber,
        this.deviceData.name,
      );

      const response = await this.nuHeatAPI.resumeSchedule(
        this.deviceData.serialNumber ?? "",
      );

      if (!response) {
        this.log.error("Error resuming schedule", this.deviceData.name);
        callback(new Error("Error: resumeSchedule"));
        return;
      }

      this.updateValues(response);
      callback(null);
      return;
    }

    this.log.info(
      "Setting away mode: permanent hold at " + this.awaySetPointTempC + " C",
      this.deviceData.name,
    );

    // A permanent hold keeps the away setpoint until the switch is turned
    // off, regardless of the plugin's configured holdLength.
    const response = await this.nuHeatAPI.setHeatSetpoint(
      this.deviceData.serialNumber ?? "",
      toNuHeatTemperature(this.awaySetPointTempC),
      1440,
    );

    if (!response) {
      this.log.error("Error setting the away setpoint", this.deviceData.name);
      callback(new Error("Error: setAwayEnabled"));
      return;
    }

    // The v1 write returns 204 with no content, so re-read the authoritative
    // state instead of pushing the empty response into HomeKit.
    await this.refresh();
    callback(null);
  }

  async refresh(): Promise<void> {
    const response = await this.nuHeatAPI.refreshThermostat(
      this.deviceData.serialNumber ?? "",
    );
    if (!response) {
      this.log.error("Error refreshing thermostat", this.deviceData.name);
      return;
    }
    this.updateValues(response);
  }

  updateValues(newValues: AccessoryThermostat): void {
    this.deviceData = newValues;

    // ON only when the thermostat sits in a permanent hold at exactly the
    // away setpoint — i.e. what this switch itself writes. A timed hold or
    // a running schedule reads OFF.
    const isAway =
      newValues.scheduleMode === SCHEDULE_MODE.PERMANENT_HOLD &&
      Number(newValues.setPointTemp) ===
        Number(toNuHeatTemperature(this.awaySetPointTempC));

    this.accessory
      .getService(SwitchService)
      .getCharacteristic(Characteristic.On)
      .updateValue(isAway);
  }
}

export = NuHeatAwaySwitch;
