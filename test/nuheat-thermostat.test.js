"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const NuHeatThermostat = require("../lib/NuHeatThermostat");
const helpers_1 = require("./support/helpers");
test("manual mode is exposed to HomeKit as heat, not off", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "123", swVersion: "1.0", name: "Bathroom" }, 1440, accessory, {}, homebridge);
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: false,
        operatingMode: 2,
    });
    const value = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState).value;
    assert.equal(value, Characteristic.TargetHeatingCoolingState.HEAT);
});
test("heat-only thermostats do not advertise an off target state", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "124", swVersion: "1.0", name: "Bathroom" }, 1440, accessory, {}, homebridge);
    const props = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState).props;
    assert.deepEqual(props.validValues, [Characteristic.TargetHeatingCoolingState.HEAT]);
});
test("off requests are translated to the minimum NuHeat target temperature", async () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    let requestedSetPoint;
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "125", swVersion: "1.0", name: "Bathroom" }, 1440, accessory, {
        async setHeatSetpoint(_serialNumber, setPoint) {
            requestedSetPoint = setPoint;
            return {
                Online: true,
                currentTemperature: 1209,
                setPointTemp: Number(setPoint),
                isHeating: false,
                operatingMode: 2,
            };
        },
        async refreshThermostat() {
            return {
                Online: true,
                currentTemperature: 1209,
                setPointTemp: 589,
                isHeating: false,
                operatingMode: 2,
            };
        },
    }, homebridge);
    await new Promise((resolve, reject) => {
        void thermostat.setTargetHeatingCooling(Characteristic.TargetHeatingCoolingState.OFF, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    assert.equal(requestedSetPoint, thermostat.toNuHeatTemperature(10));
    const targetState = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState).value;
    assert.equal(targetState, Characteristic.TargetHeatingCoolingState.HEAT);
});
test("hardware display units follow the NuHeat account temperature scale", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "126", swVersion: "1.0", name: "Bathroom" }, 1440, accessory, {}, homebridge, "Fahrenheit");
    const displayUnits = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TemperatureDisplayUnits).value;
    assert.equal(displayUnits, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
});
test("string online values are parsed without mutating the payload", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "456", swVersion: "1.0", name: "Ensuite" }, 1440, accessory, {}, homebridge);
    const payload = {
        Online: "'True'",
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: true,
        operatingMode: 1,
    };
    thermostat.updateValues(payload);
    const currentState = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState).value;
    assert.equal(currentState, Characteristic.CurrentHeatingCoolingState.HEAT);
    assert.equal(payload.Online, "'True'");
});
function createModeControlThermostat(api) {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "789", swVersion: "1.0", name: "Kitchen" }, 1440, accessory, api, homebridge, undefined, true);
    return { accessory, homebridge, Characteristic, thermostat };
}
test("mode control advertises off, heat, and auto target states", () => {
    const { accessory, homebridge, Characteristic } = createModeControlThermostat({});
    const props = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState).props;
    assert.deepEqual(props.validValues, [
        Characteristic.TargetHeatingCoolingState.OFF,
        Characteristic.TargetHeatingCoolingState.HEAT,
        Characteristic.TargetHeatingCoolingState.AUTO,
    ]);
});
test("mode control maps standby and schedule reads onto HomeKit states", () => {
    const { accessory, homebridge, Characteristic, thermostat } = createModeControlThermostat({});
    const targetState = () => accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState).value;
    // Auto schedule + manual operating mode is Nuheat standby.
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: false,
        operatingMode: 2,
        scheduleMode: 1,
    });
    assert.equal(targetState(), Characteristic.TargetHeatingCoolingState.OFF);
    // Auto schedule + auto operating mode is a normal scheduled run.
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: false,
        operatingMode: 1,
        scheduleMode: 1,
    });
    assert.equal(targetState(), Characteristic.TargetHeatingCoolingState.AUTO);
    // A timed hold is a heat request.
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 1209,
        isHeating: true,
        operatingMode: 1,
        scheduleMode: 2,
    });
    assert.equal(targetState(), Characteristic.TargetHeatingCoolingState.HEAT);
});
test("mode control routes off and auto requests through the v2 mode API", async () => {
    const calls = [];
    const { Characteristic, thermostat } = createModeControlThermostat({
        async setThermostatMode(_serialNumber, mode, options) {
            calls.push({ mode, options });
            return true;
        },
        async refreshThermostat() {
            return {
                Online: true,
                currentTemperature: 1209,
                setPointTemp: 1209,
                isHeating: false,
                operatingMode: 1,
                scheduleMode: 1,
            };
        },
    });
    const request = (value) => new Promise((resolve, reject) => {
        void thermostat.setTargetHeatingCooling(value, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    await request(Characteristic.TargetHeatingCoolingState.OFF);
    await request(Characteristic.TargetHeatingCoolingState.AUTO);
    await request(Characteristic.TargetHeatingCoolingState.HEAT);
    assert.equal(calls[0].mode, "off");
    assert.equal(calls[0].options.setPointTemp, thermostat.toNuHeatTemperature(10));
    assert.equal(calls[1].mode, "auto");
    assert.equal(calls[2].mode, "manual");
    // Heat requests must not carry a setpoint: HomeKit sends mode and
    // temperature as concurrent writes, and a stale setpoint here would clobber
    // the setpoint write that lands right after it.
    assert.equal(calls[2].options.setPointTemp, undefined);
});
test("mode control heat requests do not clobber a concurrent setpoint write", async () => {
    const calls = [];
    const { Characteristic, thermostat } = createModeControlThermostat({
        async setThermostatMode(_serialNumber, mode, options) {
            calls.push({ mode, options });
            return true;
        },
        async setHeatSetpoint() {
            return true;
        },
        async refreshThermostat() {
            return {
                Online: true,
                currentTemperature: 1209,
                setPointTemp: 1517,
                isHeating: true,
                operatingMode: 1,
                scheduleMode: 3,
            };
        },
    });
    // Seed a stale cached setpoint, as a poll would leave behind.
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 589,
        isHeating: false,
        operatingMode: 1,
        scheduleMode: 1,
    });
    await new Promise((resolve, reject) => {
        void thermostat.setTargetHeatingCooling(Characteristic.TargetHeatingCoolingState.HEAT, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].mode, "manual");
    assert.equal("setPointTemp" in calls[0].options, false);
});
test("setpoint writes re-read instead of pushing the empty 204 response", async () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const refreshes = [];
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "130", swVersion: "1.0", name: " " }, 1440, accessory, {
        async setHeatSetpoint() {
            // The v1 write returns 204 No Content, which resolves to `true`.
            return true;
        },
        async refreshThermostat(serialNumber) {
            refreshes.push(serialNumber);
            return {
                Online: true,
                currentTemperature: 1209,
                setPointTemp: 1517,
                isHeating: true,
                operatingMode: 1,
                scheduleMode: 3,
            };
        },
    }, homebridge);
    await new Promise((resolve, reject) => {
        void thermostat.setTargetTemperature(27, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    assert.deepEqual(refreshes, ["130"]);
    const currentTemperature = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature).value;
    const targetTemperature = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.TargetTemperature).value;
    assert.equal(currentTemperature, 12.2);
    assert.equal(targetTemperature, 15.3);
});
test("updateValues ignores non-object payloads such as the 204 literal", () => {
    const { accessory, homebridge, Characteristic } = (0, helpers_1.createThermostatHomebridgeStub)();
    const thermostat = new NuHeatThermostat((0, helpers_1.createLogStub)(), { serialNumber: "131", swVersion: "1.0", name: " " }, 1440, accessory, {}, homebridge);
    thermostat.updateValues({
        Online: true,
        currentTemperature: 1209,
        setPointTemp: 1517,
        isHeating: true,
        operatingMode: 1,
    });
    const before = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature).value;
    // A 204 response resolves to `true`; it must not replace thermostat state.
    thermostat.updateValues(true);
    const after = accessory
        .getService(homebridge.hap.Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature).value;
    assert.equal(before, 12.2);
    assert.equal(after, 12.2);
    assert.equal(thermostat.deviceData.currentTemperature, 1209);
});
