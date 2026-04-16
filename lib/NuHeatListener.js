"use strict";
const signalR = require("@microsoft/signalr");
class NuHeatListener {
    nuHeatAPI;
    nuHeatPlatform;
    log;
    notificationTypes;
    connection;
    constructor(nuHeatAPI, nuheatPlatform) {
        this.nuHeatAPI = nuHeatAPI;
        this.nuHeatPlatform = nuheatPlatform;
        this.log = nuheatPlatform.log;
        this.notificationTypes = ["2", "4"];
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("https://api.mynuheat.com/notificationsHost", {
            accessTokenFactory: async () => {
                return (await this.nuHeatAPI.returnAccessToken()) || "";
            },
        })
            .withAutomaticReconnect()
            .build();
    }
    connect() {
        this.connection
            .start()
            .then(() => {
            this.log.debug("Notification listener connection started!");
            this.connection
                .invoke("Subscribe", this.notificationTypes)
                .then(() => {
                this.log.debug("Subscribed for notifications");
            })
                .catch((err) => {
                this.log.error("Error subscribing to notifications:" + err.toString());
            });
        })
            .catch((err) => {
            this.log.error("Error starting notification listener connection:" + err.toString());
        });
        this.connection.on("Notify", (value) => {
            this.traceNotification(value);
        });
        this.connection.onreconnecting((error) => {
            this.log.debug("Notification listener reconnecting: " +
                (error?.message || "unknown error"));
        });
        this.connection.onreconnected(() => {
            this.log.debug("Notification listener reconnected");
        });
        this.connection.onclose((error) => {
            this.log.debug("Notification listener closed: " +
                (error?.message || "normal shutdown"));
        });
    }
    disconnect() {
        this.connection
            .stop()
            .then(() => {
            this.log.debug("Notification connection stopped!");
        })
            .catch((err) => {
            this.log.debug("Error closing notification listener connection: " + err.toString());
        });
    }
    unsubscribe() {
        this.connection
            .invoke("Unsubscribe", this.notificationTypes)
            .then(() => {
            this.log.debug("Unsubscribed from notifications");
        })
            .catch((err) => {
            this.log.error("Error unsubscribing from notifications: " + err.toString());
        });
    }
    traceNotification(notificationList) {
        notificationList.forEach((notification) => {
            let notificationType = "";
            switch (notification.type) {
                case 0:
                case 1:
                    notificationType = "UserAccount";
                    break;
                case 2:
                    notificationType = "Thermostat";
                    void this.nuHeatPlatform.refreshThermostats();
                    break;
                case 3:
                    notificationType = "Schedule";
                    void this.nuHeatPlatform.refreshThermostats();
                    break;
                case 4:
                    notificationType = "Group";
                    void this.nuHeatPlatform.refreshGroups();
                    break;
            }
            this.log.debug(notificationType +
                " notification for item " +
                notification.id +
                " at " +
                notification.timeStamp +
                ". Refreshing data for all " +
                notificationType +
                "s");
        });
    }
}
module.exports = NuHeatListener;
