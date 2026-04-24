const signalR = require("@microsoft/signalr") as {
  HubConnectionBuilder: new () => {
    withUrl(url: string, options: Record<string, unknown>): any;
    withAutomaticReconnect(): any;
    build(): any;
  };
};

import NuHeatAPI = require("./NuHeatAPI");
import type { LoggerLike } from "./types";

interface NotificationPlatformLike {
  log: LoggerLike;
  refreshThermostats(): Promise<boolean>;
  refreshGroups(): Promise<boolean>;
}

interface Notification {
  type: number;
  id: string | number;
  timeStamp: string;
}

const NOTIFICATION_DEDUPE_WINDOW_MS = 2000;

class NuHeatListener {
  nuHeatAPI: NuHeatAPI;
  nuHeatPlatform: NotificationPlatformLike;
  log: LoggerLike;
  notificationTypes: string[];
  connection: any;
  recentNotifications: Map<string, number>;

  constructor(nuHeatAPI: NuHeatAPI, nuheatPlatform: NotificationPlatformLike) {
    this.nuHeatAPI = nuHeatAPI;
    this.nuHeatPlatform = nuheatPlatform;
    this.log = nuheatPlatform.log;
    this.notificationTypes = ["2", "3", "4"];
    this.recentNotifications = new Map();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl("https://api.mynuheat.com/notificationsHost", {
        accessTokenFactory: async () => {
          return (await this.nuHeatAPI.returnAccessToken()) || "";
        },
      })
      .withAutomaticReconnect()
      .build();
  }

  connect(): void {
    this.connection
      .start()
      .then(() => {
        this.log.debug("Notification listener connection started!");
        this.connection
          .invoke("Subscribe", this.notificationTypes)
          .then(() => {
            this.log.debug("Subscribed for notifications");
          })
          .catch((err: Error) => {
            this.log.error(
              "Error subscribing to notifications:" + err.toString(),
            );
          });
      })
      .catch((err: Error) => {
        this.log.error(
          "Error starting notification listener connection:" + err.toString(),
        );
      });

    this.connection.on("Notify", (value: Notification[]) => {
      this.traceNotification(value);
    });

    this.connection.onreconnecting((error?: Error) => {
      this.log.debug(
        "Notification listener reconnecting: " +
          (error?.message || "unknown error"),
      );
    });

    this.connection.onreconnected(() => {
      this.log.debug("Notification listener reconnected");
    });

    this.connection.onclose((error?: Error) => {
      this.log.debug(
        "Notification listener closed: " +
          (error?.message || "normal shutdown"),
      );
    });
  }

  disconnect(): void {
    this.connection
      .stop()
      .then(() => {
        this.log.debug("Notification connection stopped!");
      })
      .catch((err: Error) => {
        this.log.debug(
          "Error closing notification listener connection: " + err.toString(),
        );
      });
  }

  unsubscribe(): void {
    this.connection
      .invoke("Unsubscribe", this.notificationTypes)
      .then(() => {
        this.log.debug("Unsubscribed from notifications");
      })
      .catch((err: Error) => {
        this.log.error(
          "Error unsubscribing from notifications: " + err.toString(),
        );
      });
  }

  traceNotification(notificationList: Notification[]): void {
    let shouldRefreshThermostats = false;
    let shouldRefreshGroups = false;

    notificationList.forEach((notification) => {
      let notificationType = "Unknown";
      switch (notification.type) {
        case 0:
        case 1:
          notificationType = "UserAccount";
          break;
        case 2:
          notificationType = "Thermostat";
          if (!this.isDuplicateNotification(notification)) {
            shouldRefreshThermostats = true;
          }
          break;
        case 3:
          notificationType = "Schedule";
          if (!this.isDuplicateNotification(notification)) {
            shouldRefreshThermostats = true;
          }
          break;
        case 4:
          notificationType = "Group";
          if (!this.isDuplicateNotification(notification)) {
            shouldRefreshGroups = true;
          }
          break;
      }
      this.log.debug(
        notificationType +
          " notification for item " +
          notification.id +
          " at " +
          notification.timeStamp +
          ".",
      );
    });

    if (shouldRefreshThermostats) {
      void this.nuHeatPlatform.refreshThermostats();
    }

    if (shouldRefreshGroups) {
      void this.nuHeatPlatform.refreshGroups();
    }
  }

  isDuplicateNotification(notification: Notification): boolean {
    const key =
      String(notification.type) +
      ":" +
      String(notification.id) +
      ":" +
      notification.timeStamp;
    const now = Date.now();

    this.cleanupRecentNotifications(now);

    const lastSeenAt = this.recentNotifications.get(key);
    if (
      lastSeenAt !== undefined &&
      now - lastSeenAt < NOTIFICATION_DEDUPE_WINDOW_MS
    ) {
      this.log.debug(
        "Ignoring duplicate notification " + key + ".",
      );
      return true;
    }

    this.recentNotifications.set(key, now);
    return false;
  }

  cleanupRecentNotifications(now: number): void {
    for (const [key, seenAt] of this.recentNotifications.entries()) {
      if (now - seenAt >= NOTIFICATION_DEDUPE_WINDOW_MS) {
        this.recentNotifications.delete(key);
      }
    }
  }
}

export = NuHeatListener;
