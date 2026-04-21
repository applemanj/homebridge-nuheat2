"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeService = exports.FakeCharacteristic = exports.FakeAccessory = void 0;
exports.createLogStub = createLogStub;
exports.createSwitchHomebridgeStub = createSwitchHomebridgeStub;
exports.createThermostatHomebridgeStub = createThermostatHomebridgeStub;
class FakeCharacteristic {
    name;
    value;
    handlers;
    props;
    constructor(name) {
        this.name = name;
        this.value = undefined;
        this.handlers = new Map();
        this.props = {};
    }
    setProps(props) {
        this.props = { ...this.props, ...props };
        return this;
    }
    on(event, handler) {
        this.handlers.set(event, handler);
        return this;
    }
    updateValue(value) {
        this.value = value;
        return this;
    }
    setCharacteristic() {
        return this;
    }
}
exports.FakeCharacteristic = FakeCharacteristic;
class FakeService {
    characteristics;
    constructor() {
        this.characteristics = new Map();
    }
    getCharacteristic(name) {
        const key = String(name);
        if (!this.characteristics.has(key)) {
            this.characteristics.set(key, new FakeCharacteristic(key));
        }
        return this.characteristics.get(key);
    }
    setCharacteristic(name, value) {
        this.getCharacteristic(name).value = value;
        return this;
    }
}
exports.FakeService = FakeService;
class FakeAccessory {
    services;
    constructor() {
        this.services = new Map();
    }
    getService(name) {
        const key = String(name);
        if (!this.services.has(key)) {
            this.services.set(key, new FakeService());
        }
        return this.services.get(key);
    }
    addService(name) {
        return this.getService(name);
    }
}
exports.FakeAccessory = FakeAccessory;
function createThermostatHomebridgeStub() {
    const Characteristic = {
        Manufacturer: "Manufacturer",
        Model: "Model",
        SerialNumber: "SerialNumber",
        FirmwareRevision: "FirmwareRevision",
        CurrentTemperature: "CurrentTemperature",
        TargetTemperature: "TargetTemperature",
        CurrentHeatingCoolingState: {
            OFF: 0,
            HEAT: 1,
            COOL: 2,
        },
        TargetHeatingCoolingState: {
            OFF: 0,
            HEAT: 1,
            COOL: 2,
            AUTO: 3,
        },
        TemperatureDisplayUnits: {
            CELSIUS: 0,
            FAHRENHEIT: 1,
        },
    };
    return {
        Characteristic,
        accessory: new FakeAccessory(),
        homebridge: {
            hap: {
                Characteristic,
                Service: {
                    Thermostat: "Thermostat",
                    AccessoryInformation: "AccessoryInformation",
                },
                uuid: {
                    generate(value) {
                        return value;
                    },
                },
            },
        },
    };
}
function createSwitchHomebridgeStub() {
    const Characteristic = {
        Manufacturer: "Manufacturer",
        Model: "Model",
        SerialNumber: "SerialNumber",
        On: "On",
    };
    return {
        Characteristic,
        accessory: new FakeAccessory(),
        homebridge: {
            hap: {
                Characteristic,
                Service: {
                    Switch: "Switch",
                    AccessoryInformation: "AccessoryInformation",
                },
                uuid: {
                    generate(value) {
                        return value;
                    },
                },
            },
        },
    };
}
function createLogStub() {
    return {
        info() { },
        debug() { },
        error() { },
        warn() { },
    };
}
