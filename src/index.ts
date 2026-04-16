import NuHeatAPI = require("./lib/NuHeatAPI");
import NuHeatGroup = require("./lib/NuHeatGroup");
import NuHeatScheduleSwitch = require("./lib/NuHeatScheduleSwitch");
import NuHeatThermostat = require("./lib/NuHeatThermostat");
import NuHeatListener = require("./lib/NuHeatListener");
import { Logger } from "./lib/logger";
import type {
  AccessoryAccount,
  AccessoryEntry,
  AccessoryGroup,
  AccessoryLike,
  AccessoryThermostat,
  DeviceConfig,
  GroupConfig,
  HomebridgeLike,
  LogTarget,
  PlatformApiLike,
  PlatformConfig,
  UpdatableAccessory,
} from "./lib/types";

let Homebridge: HomebridgeLike;
let PlatformAccessory: new (name: string, uuid: string) => AccessoryLike;
let Service: Record<string, any>;
let Characteristic: Record<string, any>;
let UUIDGen: { generate(value: string): string };

const PLUGIN_NAME = "homebridge-nuheat2";
const PLATFORM_NAME = "NuHeat";

function registerPlatform(homebridge: HomebridgeLike): void {
  Homebridge = homebridge;
  PlatformAccessory = homebridge.platformAccessory!;
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform!(
    PLUGIN_NAME,
    PLATFORM_NAME,
    NuHeatPlatform,
    true,
  );
}

type ManagedAccessory =
  | AccessoryLike
  | UpdatableAccessory<AccessoryGroup>
  | UpdatableAccessory<AccessoryThermostat>;

function isUpdatableAccessory(
  accessory?: ManagedAccessory,
): accessory is Exclude<ManagedAccessory, AccessoryLike> {
  return !!accessory && typeof (accessory as UpdatableAccessory).updateValues === "function";
}

function getPlatformAccessory(accessory: ManagedAccessory): AccessoryLike {
  return isUpdatableAccessory(accessory) ? accessory.accessory : accessory;
}

class NuHeatPlatform {
  disabled?: boolean;
  config!: PlatformConfig;
  api!: PlatformApiLike;
  accessories: Array<AccessoryEntry<ManagedAccessory>> = [];
  log!: Logger;
  refreshTimer: NodeJS.Timeout | null = null;
  didFinishLaunching = false;
  NuHeatAPI!: NuHeatAPI;
  NuHeatListener: NuHeatListener | null = null;
  account?: AccessoryAccount;

  constructor(log: LogTarget, config: PlatformConfig, api: PlatformApiLike) {
    if (!config) {
      log.warn("Ignoring NuHeat Platform setup because it is not configured");
      this.disabled = true;
      return;
    }

    if ((!config.Email && !config.email) || !config.password) {
      log.warn(
        "Ignoring NuHeat Platform setup because it is not configured properly. Missing email or password",
      );
      this.disabled = true;
      return;
    }

    this.config = config;
    this.config.email = this.config.Email || this.config.email;
    this.config.holdLength = Math.min(
      1440,
      Math.max(0, this.config.holdLength || 1440),
    );
    this.api = api;
    this.log = new Logger(log, this.config.debug || false);

    if (this.api?.on) {
      this.api.on("didFinishLaunching", async () => {
        this.didFinishLaunching = true;
        await this.setupPlatform();
      });
      this.api.on("shutdown", () => {
        this.teardown();
      });
    } else {
      void this.setupPlatform();
    }
  }

  configureAccessory(accessory: AccessoryLike): void {
    this.accessories.push({ uuid: accessory.UUID || "", accessory });
  }

  getConfiguredGroups(): GroupConfig[] {
    return (this.config.groups || []).filter(
      (group): group is GroupConfig =>
        !!group &&
        typeof group.groupName === "string" &&
        group.groupName.trim().length > 0,
    );
  }

  shouldManageGroups(): boolean {
    return (
      !!this.config.autoPopulateAwayModeSwitches ||
      this.getConfiguredGroups().length > 0
    );
  }

  async setupPlatform(): Promise<void> {
    if (this.disabled) {
      return;
    }

    if (this.api?.on && !this.didFinishLaunching) {
      return;
    }

    this.log.info("Logging into NuHeat...");
    this.NuHeatAPI = new NuHeatAPI(
      this.config.email || "",
      this.config.password || "",
      this.log,
      {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUri: this.config.redirectUri,
      },
    );

    if (await this.NuHeatAPI.returnAccessToken()) {
      await this.loadAccount();
      await this.setupGroups();
      await this.setupThermostats();
      this.cleanupRemovedAccessories();

      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }

      this.refreshTimer = setInterval(
        this.refreshAccessories.bind(this),
        (this.config.refresh || 60) * 1000,
      );

      if (this.config.enableNotifications === false) {
        this.log.info("NuHeat notifications are disabled. Using REST polling only.");
      } else if (!this.NuHeatListener) {
        this.NuHeatListener = new NuHeatListener(this.NuHeatAPI, this);
        this.NuHeatListener.connect();
      }
    } else {
      this.log.error("Unable to acquire an access token. We will try again later.");
      setTimeout(
        this.setupPlatform.bind(this),
        (this.config.refresh || 60) * 1000,
      );
    }
  }

  async setupGroups(): Promise<void> {
    const groupArray = this.getConfiguredGroups();
    if (!this.shouldManageGroups()) {
      return;
    }

    const response = await this.NuHeatAPI.refreshGroups();
    if (!response || !Array.isArray(response)) {
      this.log.error("Error getting data from NuHeatAPI");
      return;
    }

    if (groupArray.length === 0) {
      this.log.info(
        "No groups defined in config. Auto populating away mode switches by pulling all groups from the account.",
      );
    }

    await Promise.all(
      response.map(async (deviceData: AccessoryGroup) => {
        if (
          !(
            groupArray.length === 0 ||
            groupArray.find(
              (device) =>
                device.groupName == deviceData.groupName && !device.disabled,
            )
          )
        ) {
          return;
        }

        const uuid = UUIDGen.generate(String(deviceData.groupId));
        let entry = this.accessories.find((a) => a.uuid === uuid);
        let deviceAccessory = entry ? entry.accessory : undefined;

        if (!deviceAccessory) {
          this.log.info("Creating new away mode switch", deviceData.groupName);
          const accessory = new PlatformAccessory(deviceData.groupName || "NuHeat Group", uuid);
          accessory.addService(
            Service.Switch,
            (deviceData.groupName || "NuHeat Group") + " Away Mode",
          );
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ]);
          deviceAccessory = accessory;
          entry = { uuid };
          this.accessories.push(entry);
        }

        entry!.accessory = new NuHeatGroup(
          this.log,
          deviceData,
          getPlatformAccessory(deviceAccessory),
          this.NuHeatAPI,
          Homebridge,
        );
        entry!.existsInConfig = true;
        this.log.info("Loaded away mode switch", deviceData.groupName);
        if (isUpdatableAccessory(entry!.accessory)) {
          entry!.accessory.updateValues(deviceData);
        }
      }),
    );
  }

  async setupThermostats(): Promise<void> {
    const deviceArray = this.config.devices || [];
    const response = await this.NuHeatAPI.refreshThermostats();

    if (!response || !Array.isArray(response)) {
      this.log.error("Error getting data from NuHeatAPI");
      return;
    }

    if (deviceArray.length === 0) {
      this.log.info(
        "No devices defined in config. Auto populating thermostats by pulling everything from the account.",
      );
    }

    await Promise.all(
      response.map(async (deviceData: AccessoryThermostat) => {
        if (
          !(
            deviceArray.length === 0 ||
            deviceArray.find(
              (device: DeviceConfig) =>
                device.serialNumber == deviceData.serialNumber &&
                !device.disabled,
            )
          )
        ) {
          return;
        }

        const uuid = UUIDGen.generate(String(deviceData.serialNumber));
        let entry = this.accessories.find((a) => a.uuid === uuid);
        let deviceAccessory = entry ? entry.accessory : undefined;

        if (!deviceAccessory) {
          this.log.info(
            "Creating new thermostat for serial number: " +
              deviceData.serialNumber,
          );
          const accessory = new PlatformAccessory(deviceData.name || "NuHeat Thermostat", uuid);
          accessory.addService(Service.Thermostat, deviceData.name);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ]);
          deviceAccessory = accessory;
          entry = { uuid };
          this.accessories.push(entry);
        }

        entry!.accessory = new NuHeatThermostat(
          this.log,
          deviceData,
          this.config.holdLength || 1440,
          getPlatformAccessory(deviceAccessory),
          this.NuHeatAPI,
          Homebridge,
        );
        entry!.existsInConfig = true;
        this.log.info(
          "Loaded thermostat " +
            deviceData.serialNumber +
            " " +
            deviceData.name,
        );
        if (isUpdatableAccessory(entry!.accessory)) {
          entry!.accessory.updateValues(deviceData);
        }

        if (this.config.exposeScheduleSwitches) {
          this.setupScheduleSwitch(deviceData);
        }
      }),
    );
  }

  setupScheduleSwitch(deviceData: AccessoryThermostat): void {
    const uuid = UUIDGen.generate(String(deviceData.serialNumber) + "-schedule");
    let entry = this.accessories.find((a) => a.uuid === uuid);
    let deviceAccessory = entry ? entry.accessory : undefined;

    if (!deviceAccessory) {
      this.log.info("Creating schedule switch for thermostat", deviceData.name);
      const accessory = new PlatformAccessory(
        (deviceData.name || "NuHeat Thermostat") + " Schedule",
        uuid,
      );
      accessory.addService(
        Service.Switch,
        (deviceData.name || "NuHeat Thermostat") + " Schedule",
      );
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
      deviceAccessory = accessory;
      entry = { uuid };
      this.accessories.push(entry);
    }

    entry!.accessory = new NuHeatScheduleSwitch(
      this.log,
      deviceData,
      getPlatformAccessory(deviceAccessory),
      this.NuHeatAPI,
      Homebridge,
    );
    entry!.existsInConfig = true;
    if (isUpdatableAccessory(entry!.accessory)) {
      entry!.accessory.updateValues(deviceData);
    }
  }

  cleanupRemovedAccessories(): void {
    this.accessories.forEach((thisAccessory) => {
      if (thisAccessory.existsInConfig !== true && thisAccessory.accessory) {
        const platformAccessory = getPlatformAccessory(thisAccessory.accessory);
        try {
          this.log.info(
            "Deleting removed accessory",
            String(
              platformAccessory
                .getService(Service.AccessoryInformation)
                .getCharacteristic(Characteristic.Name).value,
            ),
          );
        } catch {
          this.log.info("Deleting removed accessory");
        }

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          platformAccessory,
        ]);
      }
    });
  }

  async refreshAccessories(): Promise<void> {
    if (this.shouldManageGroups()) {
      await this.refreshGroups();
    }
    await this.refreshThermostats();
  }

  async refreshGroups(): Promise<boolean> {
    if (!this.shouldManageGroups()) {
      return true;
    }

    this.log.debug("Trying to refresh groups.");
    const response = await this.NuHeatAPI.refreshGroups();

    if (!response || !Array.isArray(response)) {
      this.log.error("Error getting data from NuHeatAPI in group refresh");
      return false;
    }

    response.forEach((deviceData: AccessoryGroup) => {
      const thisAccessory = this.accessories.find(
        (accessory) =>
          accessory.uuid === UUIDGen.generate(String(deviceData.groupId)),
      );
      if (isUpdatableAccessory(thisAccessory?.accessory)) {
        thisAccessory.accessory.updateValues(deviceData);
      }
    });

    return true;
  }

  async refreshThermostats(): Promise<boolean> {
    this.log.debug("Trying to refresh thermostats.");
    const response = await this.NuHeatAPI.refreshThermostats();

    if (!response || !Array.isArray(response)) {
      this.log.error("Error getting data from NuHeatAPI in thermostat refresh");
      return false;
    }

    response.forEach((deviceData: AccessoryThermostat) => {
      const thisAccessory = this.accessories.find(
        (accessory) =>
          accessory.uuid ===
          UUIDGen.generate(String(deviceData.serialNumber)),
      );
      if (isUpdatableAccessory(thisAccessory?.accessory)) {
        thisAccessory.accessory.updateValues(deviceData);
      }

      const scheduleAccessory = this.accessories.find(
        (accessory) =>
          accessory.uuid ===
          UUIDGen.generate(String(deviceData.serialNumber) + "-schedule"),
      );
      if (isUpdatableAccessory(scheduleAccessory?.accessory)) {
        scheduleAccessory.accessory.updateValues(deviceData);
      }
    });

    return true;
  }

  async loadAccount(): Promise<void> {
    const account = await this.NuHeatAPI.getAccount();
    if (!account || Array.isArray(account) || typeof account === "boolean") {
      return;
    }

    this.account = account;
    this.log.debug(
      "NuHeat account preferences loaded. Temperature scale: " +
        (account.temperatureScale || "unknown") +
        ", 12-hour clock: " +
        String(account.use12Hour),
    );
  }

  teardown(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.NuHeatListener) {
      this.NuHeatListener.disconnect();
      this.NuHeatListener = null;
    }
  }
}

export = registerPlatform;
