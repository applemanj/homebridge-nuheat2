import test = require("node:test");
import assert = require("node:assert/strict");

import NuHeatThermostat = require("../lib/NuHeatThermostat");
import {
  createLogStub,
  createThermostatHomebridgeStub,
} from "./support/helpers";

test("manual mode is exposed to HomeKit as heat, not off", () => {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "123", swVersion: "1.0", name: "Bathroom" },
    1440,
    accessory,
    {} as any,
    homebridge,
  );

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
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();

  new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "124", swVersion: "1.0", name: "Bathroom" },
    1440,
    accessory,
    {} as any,
    homebridge,
  );

  const props = accessory
    .getService(homebridge.hap.Service.Thermostat)
    .getCharacteristic(Characteristic.TargetHeatingCoolingState).props;

  assert.deepEqual(props.validValues, [Characteristic.TargetHeatingCoolingState.HEAT]);
});

test("off requests are translated to the minimum NuHeat target temperature", async () => {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  let requestedSetPoint: string | undefined;
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "125", swVersion: "1.0", name: "Bathroom" },
    1440,
    accessory,
    {
      async setHeatSetpoint(_serialNumber: string, setPoint: string) {
        requestedSetPoint = setPoint;
        return {
          Online: true,
          currentTemperature: 1209,
          setPointTemp: Number(setPoint),
          isHeating: false,
          operatingMode: 2,
        };
      },
    } as any,
    homebridge,
  );

  await new Promise<void>((resolve, reject) => {
    void thermostat.setTargetHeatingCooling(
      Characteristic.TargetHeatingCoolingState.OFF,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });

  assert.equal(requestedSetPoint, thermostat.toNuHeatTemperature(10));
  const targetState = accessory
    .getService(homebridge.hap.Service.Thermostat)
    .getCharacteristic(Characteristic.TargetHeatingCoolingState).value;
  assert.equal(targetState, Characteristic.TargetHeatingCoolingState.HEAT);
});

test("hardware display units follow the NuHeat account temperature scale", () => {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();

  new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "126", swVersion: "1.0", name: "Bathroom" },
    1440,
    accessory,
    {} as any,
    homebridge,
    "Fahrenheit",
  );

  const displayUnits = accessory
    .getService(homebridge.hap.Service.Thermostat)
    .getCharacteristic(Characteristic.TemperatureDisplayUnits).value;

  assert.equal(displayUnits, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
});

test("string online values are parsed without mutating the payload", () => {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "456", swVersion: "1.0", name: "Ensuite" },
    1440,
    accessory,
    {} as any,
    homebridge,
  );

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

function createModeControlThermostat(api: any) {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "789", swVersion: "1.0", name: "Kitchen" },
    1440,
    accessory,
    api,
    homebridge,
    undefined,
    true,
  );

  return { accessory, homebridge, Characteristic, thermostat };
}

test("mode control advertises off, heat, and auto target states", () => {
  const { accessory, homebridge, Characteristic } =
    createModeControlThermostat({});

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
  const { accessory, homebridge, Characteristic, thermostat } =
    createModeControlThermostat({});
  const targetState = () =>
    accessory
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
  const calls: Array<{ mode: string; options: any }> = [];
  const { Characteristic, thermostat } = createModeControlThermostat({
    async setThermostatMode(_serialNumber: string, mode: string, options: any) {
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

  const request = (value: number) =>
    new Promise<void>((resolve, reject) => {
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
});
