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
      async refreshThermostat() {
        return {
          Online: true,
          currentTemperature: 1209,
          setPointTemp: 589,
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

  // An auto schedule is a scheduled run even when the thermostat reports a
  // manual operating mode; standby is identified by the setpoint instead.
  thermostat.updateValues({
    Online: true,
    currentTemperature: 1209,
    setPointTemp: 1209,
    isHeating: false,
    operatingMode: 2,
    scheduleMode: 1,
  });
  assert.equal(targetState(), Characteristic.TargetHeatingCoolingState.AUTO);

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

test("mode control reads a requested off back as off", async () => {
  const { accessory, homebridge, Characteristic, thermostat } =
    createModeControlThermostat({
      async setThermostatMode() {
        return true;
      },
      async refreshThermostat() {
        // Live capture from a Signature thermostat after a v2 off write: the
        // setpoint lands at the 10 C minimum and the thermostat reads back
        // as a permanent hold, which must map to HomeKit off.
        return {
          Online: true,
          currentTemperature: 1209,
          setPointTemp: 985,
          isHeating: false,
          operatingMode: 2,
          scheduleMode: 3,
        };
      },
    });

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

  const targetState = accessory
    .getService(homebridge.hap.Service.Thermostat)
    .getCharacteristic(Characteristic.TargetHeatingCoolingState).value;
  assert.equal(targetState, Characteristic.TargetHeatingCoolingState.OFF);
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
  // Heat requests must not carry a setpoint: HomeKit sends mode and
  // temperature as concurrent writes, and a stale setpoint here would clobber
  // the setpoint write that lands right after it.
  assert.equal(calls[2].options.setPointTemp, undefined);
});

test("mode control heat requests do not clobber a concurrent setpoint write", async () => {
  const calls: Array<{ mode: string; options: any }> = [];
  const { Characteristic, thermostat } = createModeControlThermostat({
    async setThermostatMode(_serialNumber: string, mode: string, options: any) {
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

  await new Promise<void>((resolve, reject) => {
    void thermostat.setTargetHeatingCooling(
      Characteristic.TargetHeatingCoolingState.HEAT,
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "manual");
  assert.equal("setPointTemp" in calls[0].options, false);
});

test("setpoint writes re-read instead of pushing the empty 204 response", async () => {
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const refreshes: Array<string | undefined> = [];
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "130", swVersion: "1.0", name: " " },
    1440,
    accessory,
    {
      async setHeatSetpoint() {
        // The v1 write returns 204 No Content, which resolves to `true`.
        return true;
      },
      async refreshThermostat(serialNumber: string) {
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
    } as any,
    homebridge,
  );

  await new Promise<void>((resolve, reject) => {
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
  const { accessory, homebridge, Characteristic } =
    createThermostatHomebridgeStub();
  const thermostat = new NuHeatThermostat(
    createLogStub(),
    { serialNumber: "131", swVersion: "1.0", name: " " },
    1440,
    accessory,
    {} as any,
    homebridge,
  );

  thermostat.updateValues({
    Online: true,
    currentTemperature: 1209,
    setPointTemp: 1517,
    isHeating: true,
    operatingMode: 1,
  } as any);

  const before = accessory
    .getService(homebridge.hap.Service.Thermostat)
    .getCharacteristic(Characteristic.CurrentTemperature).value;

  // A 204 response resolves to `true`; it must not replace thermostat state.
  thermostat.updateValues(true as any);

  const after = accessory
    .getService(homebridge.hap.Service.Thermostat)
    .getCharacteristic(Characteristic.CurrentTemperature).value;

  assert.equal(before, 12.2);
  assert.equal(after, 12.2);
  assert.equal(
    (thermostat as any).deviceData.currentTemperature,
    1209,
  );
});
