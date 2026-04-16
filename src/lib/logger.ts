import type { LogTarget } from "./types";

export class Logger {
  log: LogTarget;
  debugMode: boolean;

  constructor(log: LogTarget, debugMode = false) {
    this.log = log;
    this.debugMode =
      debugMode ||
      process.argv.includes("-D") ||
      process.argv.includes("--debug");
  }

  formatMessage(message: string, device?: string): string {
    let formatted = "";
    if (device) {
      formatted += "[" + device + "] ";
    }
    formatted += message;
    return formatted;
  }

  info(message: string, device?: string): void {
    this.log.info(this.formatMessage(message, device));
  }

  warn(message: string, device?: string): void {
    this.log.warn(this.formatMessage(message, device));
  }

  error(message: string, device?: string): void {
    this.log.error(this.formatMessage(message, device));
  }

  debug(message: string, device?: string, alwaysLog = false): void {
    if (this.debugMode) {
      this.log.info(this.formatMessage(message, device));
    } else if (alwaysLog) {
      this.info(message, device);
    } else if (this.log.debug) {
      this.log.debug(this.formatMessage(message, device));
    } else {
      this.log.info(this.formatMessage(message, device));
    }
  }
}
