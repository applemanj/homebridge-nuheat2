"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    log;
    debugMode;
    constructor(log, debugMode = false) {
        this.log = log;
        this.debugMode =
            debugMode ||
                process.argv.includes("-D") ||
                process.argv.includes("--debug");
    }
    formatMessage(message, device) {
        let formatted = "";
        if (device) {
            formatted += "[" + device + "] ";
        }
        formatted += message;
        return formatted;
    }
    info(message, device) {
        this.log.info(this.formatMessage(message, device));
    }
    warn(message, device) {
        this.log.warn(this.formatMessage(message, device));
    }
    error(message, device) {
        this.log.error(this.formatMessage(message, device));
    }
    debug(message, device, alwaysLog = false) {
        if (this.debugMode) {
            this.log.info(this.formatMessage(message, device));
        }
        else if (alwaysLog) {
            this.info(message, device);
        }
        else if (this.log.debug) {
            this.log.debug(this.formatMessage(message, device));
        }
        else {
            this.log.info(this.formatMessage(message, device));
        }
    }
}
exports.Logger = Logger;
