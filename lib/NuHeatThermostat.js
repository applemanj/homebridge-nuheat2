"use strict";
const NuHeatModels_1 = require("./NuHeatModels");
let Characteristic;
let ThermostatService;
const MIN_TARGET_TEMPERATURE_C = 10;
const MAX_TARGET_TEMPERATURE_C = 38;
class NuHeatThermostat {
    log;
    deviceData;
    holdLength;
    accessory;
    NuHeatAPI;
    temperatureScale;
    enableThermostatModeControl;
    constructor(log, deviceData, holdLength, accessory, NuHeatAPI, homebridge, temperatureScale, enableThermostatModeControl = false) {
        Characteristic = homebridge.hap.Characteristic;
        ThermostatService = homebridge.hap.Service.Thermostat;
        this.log = log;
        this.deviceData = deviceData;
        this.holdLength = holdLength;
        this.accessory = accessory;
        this.NuHeatAPI = NuHeatAPI;
        this.temperatureScale = temperatureScale;
        this.enableThermostatModeControl = enableThermostatModeControl;
        this.accessory
            .getService(homebridge.hap.Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "NuHeat")
            .setCharacteristic(Characteristic.Model, "Signature")
            .setCharacteristic(Characteristic.SerialNumber, this.deviceData.serialNumber)
            .setCharacteristic(Characteristic.FirmwareRevision, this.deviceData.swVersion);
        this.setupListeners();
    }
    setupListeners() {
        const thermostatService = this.accessory.getService(ThermostatService);
        this.log.info("holdLength: " + this.holdLength, this.deviceData.name);
        const targetHeatingCoolingStates = this.enableThermostatModeControl
            ? [
                Characteristic.TargetHeatingCoolingState.OFF,
                Characteristic.TargetHeatingCoolingState.HEAT,
                Characteristic.TargetHeatingCoolingState.AUTO,
            ]
            : [Characteristic.TargetHeatingCoolingState.HEAT];
        thermostatService
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
            validValues: targetHeatingCoolingStates,
        })
            .on("set", this.setTargetHeatingCooling.bind(this));
        thermostatService.getCharacteristic(Characteristic.CurrentTemperature).setProps({
            minValue: -100,
            maxValue: 100,
        });
        thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
            minStep: 0.5,
        })
            .on("set", this.setTargetTemperature.bind(this));
        this.updateTemperatureDisplayUnits();
    }
    async setTargetHeatingCooling(value, callback) {
        if (this.enableThermostatModeControl) {
            await this.setThermostatModeFromHomeKit(value, callback);
            return;
        }
        if (value !== Characteristic.TargetHeatingCoolingState.OFF) {
            callback(null);
            void this.updateAccessory();
            return;
        }
        this.log.info("NuHeat does not support an off mode. Setting the thermostat to its minimum target temperature instead.", this.deviceData.name);
        const response = await this.NuHeatAPI.setHeatSetpoint(this.deviceData.serialNumber ?? "", this.toNuHeatTemperature(MIN_TARGET_TEMPERATURE_C), this.holdLength);
        if (!response) {
            this.log.error("Error setting minimum target temperature for off request", this.deviceData.name);
            callback(new Error("Error: setTargetHeatingCooling"));
            return;
        }
        this.updateValues(response);
        callback(null);
    }
    /**
     * The v1 update model cannot request standby or an indefinite auto schedule,
     * so mode changes go through the v2 mode endpoints. Those writes return no
     * content, so the authoritative state is re-read through v1 afterwards.
     */
    async setThermostatModeFromHomeKit(value, callback) {
        const { OFF, HEAT, AUTO } = Characteristic.TargetHeatingCoolingState;
        let mode;
        const options = {};
        if (value === OFF) {
            mode = NuHeatModels_1.HEATING_MODE.OFF;
            options.setPointTemp = this.toNuHeatTemperature(MIN_TARGET_TEMPERATURE_C);
            this.log.info("Setting the thermostat to standby (minimum target temperature).", this.deviceData.name);
        }
        else if (value === AUTO) {
            mode = NuHeatModels_1.HEATING_MODE.AUTO;
            this.log.info("Resuming the NuHeat schedule.", this.deviceData.name);
        }
        else if (value === HEAT) {
            options.setPointTemp =
                this.deviceData.setPointTemp ??
                    this.toNuHeatTemperature(MIN_TARGET_TEMPERATURE_C);
            if (this.holdLength >= 1440) {
                mode = NuHeatModels_1.HEATING_MODE.MANUAL;
            }
            else {
                mode = NuHeatModels_1.HEATING_MODE.HOLD;
                if (this.holdLength > 0) {
                    options.holdLength = this.holdLength;
                }
            }
            this.log.info("Holding the thermostat target temperature.", this.deviceData.name);
        }
        else {
            this.log.error("Unsupported target heating state " + value, this.deviceData.name);
            callback(new Error("Error: setTargetHeatingCooling"));
            return;
        }
        const response = await this.NuHeatAPI.setThermostatMode(this.deviceData.serialNumber ?? "", mode, options);
        if (!response) {
            this.log.error("Error setting thermostat mode", this.deviceData.name);
            callback(new Error("Error: setTargetHeatingCooling"));
            return;
        }
        await this.updateAccessory();
        callback(null);
    }
    async setTargetTemperature(value, callback) {
        this.log.info("Setting target temperature to " + value + " C", this.deviceData.name);
        if (value < MIN_TARGET_TEMPERATURE_C)
            value = MIN_TARGET_TEMPERATURE_C;
        if (value > MAX_TARGET_TEMPERATURE_C)
            value = MAX_TARGET_TEMPERATURE_C;
        const heatSetPoint = this.toNuHeatTemperature(value);
        this.log.debug("setTargetTemperature " + heatSetPoint, this.deviceData.name);
        const response = await this.NuHeatAPI.setHeatSetpoint(this.deviceData.serialNumber ?? "", heatSetPoint, this.holdLength);
        if (!response) {
            this.log.error("Error setting target temperature", this.deviceData.name);
            callback(new Error("Error: setTargetTemperature"));
        }
        else {
            this.updateValues(response);
            callback(null);
        }
    }
    async updateAccessory() {
        const response = await this.NuHeatAPI.refreshThermostat(this.deviceData.serialNumber ?? "");
        if (!response) {
            this.log.error("Error getting updated data", this.deviceData.name);
        }
        else {
            this.updateValues(response);
        }
    }
    updateValues(newValues) {
        if (this.isOnline(newValues)) {
            this.updateTemperatureDisplayUnits();
            let currentTemperature = Number(this.toHBTemperature(newValues.currentTemperature ?? 0));
            this.log.debug("Current temperature is " + currentTemperature + " C", this.deviceData.name);
            this.accessory
                .getService(ThermostatService)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(currentTemperature);
            let setPointTemperature = Number(this.toHBTemperature(newValues.setPointTemp ?? 0));
            if (setPointTemperature < MIN_TARGET_TEMPERATURE_C) {
                setPointTemperature = MIN_TARGET_TEMPERATURE_C;
            }
            if (setPointTemperature > MAX_TARGET_TEMPERATURE_C) {
                setPointTemperature = MAX_TARGET_TEMPERATURE_C;
            }
            this.log.debug("Setpoint temperature is " + setPointTemperature + " C", this.deviceData.name);
            this.accessory
                .getService(ThermostatService)
                .getCharacteristic(Characteristic.TargetTemperature)
                .updateValue(setPointTemperature);
            let currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
            if (newValues.isHeating) {
                currentHeatingCoolingState =
                    Characteristic.CurrentHeatingCoolingState.HEAT;
            }
            this.log.debug("Current heating state is " + currentHeatingCoolingState, this.deviceData.name);
            this.accessory
                .getService(ThermostatService)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .updateValue(currentHeatingCoolingState);
            const targetHeatingCooling = this.toHomeBridgeHeatingCoolingState(newValues);
            this.log.debug("Target heating state is " + targetHeatingCooling, this.deviceData.name);
            this.accessory
                .getService(ThermostatService)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .updateValue(targetHeatingCooling);
        }
        else {
            this.log.debug("Seems to be offline according to NuHeat", this.deviceData.name);
        }
        this.deviceData = newValues;
    }
    toNuHeatTemperature(temperature) {
        return (((temperature * 9) / 5 + 32 - 33) * 56 + 33).toFixed(0);
    }
    toHBTemperature(temperature) {
        return ((((temperature - 33) / 56 + 33 - 32) * 5) / 9).toFixed(1);
    }
    toHomeBridgeHeatingCoolingState(newValues) {
        if (!this.enableThermostatModeControl) {
            if (!this.isOnline(newValues)) {
                return Characteristic.TargetHeatingCoolingState.OFF;
            }
            // The v1 read model cannot distinguish standby from a scheduled run, and
            // the characteristic only advertises heat, so heat is the only safe
            // report.
            return Characteristic.TargetHeatingCoolingState.HEAT;
        }
        switch ((0, NuHeatModels_1.deriveHeatingMode)(newValues)) {
            case NuHeatModels_1.HEATING_MODE.OFF:
                return Characteristic.TargetHeatingCoolingState.OFF;
            case NuHeatModels_1.HEATING_MODE.AUTO:
                return Characteristic.TargetHeatingCoolingState.AUTO;
            case NuHeatModels_1.HEATING_MODE.MANUAL:
            case NuHeatModels_1.HEATING_MODE.HOLD:
            default:
                return Characteristic.TargetHeatingCoolingState.HEAT;
        }
    }
    isScheduleEnabled(newValues) {
        return newValues.scheduleMode === NuHeatModels_1.SCHEDULE_MODE.AUTO;
    }
    isOnline(newValues) {
        const onlineValue = newValues.Online ?? newValues.online ?? newValues.isOnline;
        if (typeof onlineValue === "boolean") {
            return onlineValue;
        }
        if (typeof onlineValue === "string") {
            const normalizedValue = onlineValue
                .replace(/'/g, "")
                .trim()
                .toLowerCase();
            return normalizedValue === "true";
        }
        return true;
    }
    updateTemperatureDisplayUnits() {
        const displayUnits = this.toHomeKitDisplayUnits(this.temperatureScale);
        if (displayUnits === undefined ||
            !Characteristic.TemperatureDisplayUnits) {
            return;
        }
        this.accessory
            .getService(ThermostatService)
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .updateValue(displayUnits);
    }
    toHomeKitDisplayUnits(temperatureScale) {
        if (!temperatureScale || !Characteristic.TemperatureDisplayUnits) {
            return undefined;
        }
        const normalizedScale = temperatureScale.trim().toLowerCase();
        if (normalizedScale.startsWith("f")) {
            return Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
        }
        if (normalizedScale.startsWith("c")) {
            return Characteristic.TemperatureDisplayUnits.CELSIUS;
        }
        return undefined;
    }
}
module.exports = NuHeatThermostat;
