import test = require("node:test");
import assert = require("node:assert/strict");

import NuHeatListener = require("../lib/NuHeatListener");
import { createLogStub } from "./support/helpers";

test("notification batches coalesce to a single thermostat refresh", () => {
  let thermostatRefreshes = 0;
  let groupRefreshes = 0;

  const listener = new NuHeatListener({} as any, {
    log: createLogStub(),
    async refreshThermostats() {
      thermostatRefreshes += 1;
      return true;
    },
    async refreshGroups() {
      groupRefreshes += 1;
      return true;
    },
  });

  listener.traceNotification([
    { type: 2, id: "1362696", timeStamp: "2026-04-21T15:44:56Z" },
    { type: 2, id: "1362696", timeStamp: "2026-04-21T15:44:56Z" },
    { type: 3, id: "1362696", timeStamp: "2026-04-21T15:44:56Z" },
  ]);

  assert.equal(thermostatRefreshes, 1);
  assert.equal(groupRefreshes, 0);
});

test("duplicate notifications inside the dedupe window are ignored", () => {
  let thermostatRefreshes = 0;
  let now = 0;
  const originalDateNow = Date.now;
  Date.now = () => now;

  try {
    const listener = new NuHeatListener({} as any, {
      log: createLogStub(),
      async refreshThermostats() {
        thermostatRefreshes += 1;
        return true;
      },
      async refreshGroups() {
        return true;
      },
    });

    listener.traceNotification([
      { type: 2, id: "1362696", timeStamp: "2026-04-21T15:44:56Z" },
    ]);
    now = 1000;
    listener.traceNotification([
      { type: 2, id: "1362696", timeStamp: "2026-04-21T15:44:56Z" },
    ]);
    now = 2500;
    listener.traceNotification([
      { type: 2, id: "1362696", timeStamp: "2026-04-21T15:44:56Z" },
    ]);
  } finally {
    Date.now = originalDateNow;
  }

  assert.equal(thermostatRefreshes, 2);
});
