"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const signalR = require("@microsoft/signalr");
const NuHeatListener = require("../lib/NuHeatListener");
const helpers_1 = require("./support/helpers");
test("listener subscribes to Nuheat Conductor v2 notification types", () => {
    const listener = new NuHeatListener({}, {
        log: (0, helpers_1.createLogStub)(),
        async refreshThermostats() {
            return true;
        },
        async refreshGroups() {
            return true;
        },
    });
    assert.deepEqual(listener.notificationTypes, [1, 2]);
    assert.equal(listener.connectionOptions.skipNegotiation, true);
    assert.equal(listener.connectionOptions.transport, signalR.HttpTransportType.WebSockets);
});
test("notification batches coalesce to a single thermostat refresh", () => {
    let thermostatRefreshes = 0;
    let groupRefreshes = 0;
    const listener = new NuHeatListener({}, {
        log: (0, helpers_1.createLogStub)(),
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
        const listener = new NuHeatListener({}, {
            log: (0, helpers_1.createLogStub)(),
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
    }
    finally {
        Date.now = originalDateNow;
    }
    assert.equal(thermostatRefreshes, 2);
});
