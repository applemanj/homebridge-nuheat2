import type { Account, Group, Thermostat } from "./NuHeatModels";

export interface LogTarget {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug?(message: string): void;
}

export interface LoggerLike {
  info(message: string, device?: string): void;
  warn(message: string, device?: string): void;
  error(message: string, device?: string): void;
  debug(message: string, device?: string, alwaysLog?: boolean): void;
}

export interface PlatformApiLike {
  on?(event: string, handler: (...args: unknown[]) => void): void;
  registerPlatformAccessories(
    pluginName: string,
    platformName: string,
    accessories: AccessoryLike[],
  ): void;
  unregisterPlatformAccessories(
    pluginName: string,
    platformName: string,
    accessories: AccessoryLike[],
  ): void;
}

export interface CharacteristicValueLike {
  value?: unknown;
}

export interface CharacteristicLike extends CharacteristicValueLike {
  on(event: string, handler: (...args: any[]) => unknown): this;
  setProps(props: Record<string, unknown>): this;
  updateValue(value: unknown): this;
  setCharacteristic(name: unknown, value?: unknown): this;
}

export interface ServiceLike {
  getCharacteristic(name: unknown): CharacteristicLike;
  setCharacteristic(name: unknown, value: unknown): this;
}

export interface AccessoryLike {
  UUID?: string;
  getService(service: unknown): ServiceLike;
  addService(service: unknown, name?: string): ServiceLike;
}

export interface UpdatableAccessory<TValues = unknown> {
  accessory: AccessoryLike;
  updateValues(values: TValues): void;
}

export interface HomebridgeLike {
  hap: {
    Characteristic: Record<string, any>;
    Service: Record<string, any>;
    uuid: {
      generate(value: string): string;
    };
  };
  platformAccessory?: new (name: string, uuid: string) => AccessoryLike;
  registerPlatform?(
    pluginName: string,
    platformName: string,
    constructor: new (log: LogTarget, config: PlatformConfig, api: PlatformApiLike) => unknown,
    dynamicPlatform: boolean,
  ): void;
}

export interface DeviceConfig {
  serialNumber: string;
  disabled?: boolean;
}

export interface GroupConfig {
  groupName: string;
  disabled?: boolean;
}

export interface PlatformConfig {
  name?: string;
  platform?: string;
  Email?: string;
  email?: string;
  password?: string;
  devices?: DeviceConfig[];
  groups?: Array<Partial<GroupConfig>>;
  holdLength?: number;
  refresh?: number;
  debug?: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  autoPopulateAwayModeSwitches?: boolean;
  exposeScheduleSwitches?: boolean;
  enableNotifications?: boolean;
}

export interface AccessoryEntry<TAccessory = any> {
  uuid: string;
  accessory?: TAccessory;
  existsInConfig?: boolean;
}

export type AccessoryAccount = Account;
export type AccessoryGroup = Group;
export type AccessoryThermostat = Thermostat & {
  Online?: boolean | string;
  isOnline?: boolean | string;
};

export type Callback = (error: Error | null) => void;
