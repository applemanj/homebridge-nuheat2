import type NuHeatAPI = require("./NuHeatAPI");
import type {
  AccessoryGroup,
  AccessoryLike,
  Callback,
  HomebridgeLike,
  LoggerLike,
} from "./types";

let Characteristic: Record<string, any>;
let SwitchService: unknown;

class NuHeatGroup {
  log: LoggerLike;
  deviceData: AccessoryGroup;
  accessory: AccessoryLike;
  NuHeatAPI: NuHeatAPI;

  constructor(
    log: LoggerLike,
    deviceData: AccessoryGroup,
    accessory: AccessoryLike,
    NuHeatAPI: NuHeatAPI,
    homebridge: HomebridgeLike,
  ) {
    Characteristic = homebridge.hap.Characteristic;
    SwitchService = homebridge.hap.Service.Switch;
    this.log = log;
    this.deviceData = deviceData;
    this.accessory = accessory;
    this.NuHeatAPI = NuHeatAPI;

    this.accessory
      .getService(homebridge.hap.Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
      .setCharacteristic(Characteristic.Model, "Signature")
      .setCharacteristic(
        Characteristic.SerialNumber,
        "Group " + this.deviceData.groupId,
      );
    this.setupListeners();
  }

  setupListeners(): void {
    this.accessory
      .getService(SwitchService)
      .getCharacteristic(Characteristic.On)
      .on("set", this.setAwayMode.bind(this));
  }

  async setAwayMode(value: boolean, callback: Callback): Promise<void> {
    this.log.debug(
      "Setting group away mode to " + value,
      this.deviceData.groupName,
    );
    const response = await this.NuHeatAPI.setAwayMode(
      this.deviceData.groupId ?? 0,
      value,
    );
    if (!response) {
      this.log.error("Error setting away mode", this.deviceData.groupName);
      callback(new Error("Error: setAwayMode"));
    } else {
      this.updateValues({ ...this.deviceData, awayMode: value });
      callback(null);
    }
  }

  async updateAccessory(): Promise<void> {
    const response = await this.NuHeatAPI.refreshGroup(this.deviceData.groupId ?? 0);
    if (!response) {
      this.log.error("Error getting updated data", this.deviceData.groupName);
    } else {
      this.updateValues(response);
    }
  }

  updateValues(newValues: AccessoryGroup): void {
    if (newValues.awayMode) {
      this.log.debug("In away mode", this.deviceData.groupName);
      this.accessory
        .getService(SwitchService)
        .getCharacteristic(Characteristic.On)
        .updateValue(true);
    } else {
      this.log.debug("Out of away mode", this.deviceData.groupName);
      this.accessory
        .getService(SwitchService)
        .getCharacteristic(Characteristic.On)
        .updateValue(false);
    }
    this.deviceData = newValues;
  }
}

export = NuHeatGroup;
