const PLATFORM_NAME = "NuHeat";

const elements = {
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  devicesList: document.getElementById("devices-list"),
  groupsList: document.getElementById("groups-list"),
  autoPopulateAwayModeSwitches: document.getElementById(
    "auto-populate-away-mode-switches",
  ),
  exposeScheduleSwitches: document.getElementById("expose-schedule-switches"),
  holdLength: document.getElementById("hold-length"),
  refresh: document.getElementById("refresh"),
  enableNotifications: document.getElementById("enable-notifications"),
  debug: document.getElementById("debug"),
  saveAccount: document.getElementById("save-account"),
  addDevice: document.getElementById("add-device"),
  addGroup: document.getElementById("add-group"),
  saveAccessories: document.getElementById("save-accessories"),
  saveBehavior: document.getElementById("save-behavior"),
  authStatus: document.getElementById("auth-status"),
  accessoryStatus: document.getElementById("accessory-status"),
  behaviorStatus: document.getElementById("behavior-status"),
  toastContainer: document.getElementById("toast-container"),
  refreshDiagnostics: document.getElementById("refresh-diagnostics"),
  diagnosticsSummary: document.getElementById("diagnostics-summary"),
  diagnosticsEmpty: document.getElementById("diagnostics-empty"),
  diagnosticsList: document.getElementById("diagnostics-list"),
};

const state = {
  configs: [],
  config: null,
  hasPassword: false,
};

function showToast(type, message) {
  if (
    window.homebridge &&
    window.homebridge.toast &&
    typeof window.homebridge.toast[type] === "function"
  ) {
    window.homebridge.toast[type](message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

async function withSpinner(task) {
  if (window.homebridge && typeof window.homebridge.showSpinner === "function") {
    window.homebridge.showSpinner();
  }

  try {
    return await task();
  } finally {
    if (window.homebridge && typeof window.homebridge.hideSpinner === "function") {
      window.homebridge.hideSpinner();
    }
  }
}

async function loadConfig() {
  if (
    !window.homebridge ||
    typeof window.homebridge.getPluginConfig !== "function"
  ) {
    state.config = createDefaultConfig();
    renderConfig(state.config);
    showToast("warning", "Homebridge UI API unavailable; showing defaults.");
    return;
  }

  state.configs = await window.homebridge.getPluginConfig();
  state.config = findOrCreateConfig(state.configs);
  renderConfig(state.config);
}

function findOrCreateConfig(configs) {
  let config = configs.find((entry) => entry.platform === PLATFORM_NAME);
  if (!config) {
    config = createDefaultConfig();
    configs.push(config);
  }
  return config;
}

function createDefaultConfig() {
  return {
    platform: PLATFORM_NAME,
    name: "NuHeat",
    devices: [],
    groups: [],
    autoPopulateAwayModeSwitches: false,
    exposeScheduleSwitches: false,
    enableNotifications: true,
    holdLength: 1440,
    refresh: 60,
    debug: false,
  };
}

function renderConfig(config) {
  elements.email.value = config.email || config.Email || "";
  elements.password.value = "";
  state.hasPassword = Boolean(config.password);
  elements.password.placeholder = state.hasPassword
    ? "Saved password (leave blank to keep)"
    : "Password";

  renderRows(elements.devicesList, "device", config.devices || []);
  renderRows(elements.groupsList, "group", config.groups || []);
  elements.autoPopulateAwayModeSwitches.checked = Boolean(
    config.autoPopulateAwayModeSwitches,
  );
  elements.exposeScheduleSwitches.checked = Boolean(config.exposeScheduleSwitches);

  elements.holdLength.value = String(normalizeHoldLength(config.holdLength));
  elements.refresh.value = String(normalizeRefresh(config.refresh));
  elements.enableNotifications.checked = config.enableNotifications !== false;
  elements.debug.checked = Boolean(config.debug);

  updateStatuses();
  renderDiagnostics();
}

function renderRows(container, type, items) {
  container.innerHTML = "";
  const visibleItems = normalizeConfigRows(type, items);

  if (visibleItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent =
      type === "device"
        ? "No thermostat allow-list. All thermostats will be discovered."
        : "No group allow-list. Groups stay hidden unless auto-populate is enabled.";
    container.appendChild(empty);
    return;
  }

  visibleItems.forEach((item) => {
    addRow(
      container,
      type,
      item.value,
      item.disabled,
    );
  });
}

function normalizeConfigRows(type, items) {
  const normalizedItems = Array.isArray(items) ? items : [];
  return normalizedItems
    .map((item) => ({
      value: getConfigRowValue(type, item),
      disabled: typeof item === "object" && item !== null
        ? Boolean(item.disabled)
        : false,
    }))
    .filter((item) => item.value.length > 0);
}

function getConfigRowValue(type, item) {
  if (typeof item === "string" || typeof item === "number") {
    return String(item).trim();
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  const keys = type === "device"
    ? ["serialNumber", "SerialNumber", "serial", "Serial", "deviceId", "DeviceId"]
    : ["groupName", "GroupName", "name", "Name"];

  const value = keys
    .map((key) => item[key])
    .find((candidate) => typeof candidate === "string" || typeof candidate === "number");

  return value === undefined ? "" : String(value).trim();
}

function addRow(container, type, value = "", disabled = false) {
  const empty = container.querySelector(".empty-list");
  if (empty) {
    empty.remove();
  }

  const row = document.createElement("div");
  row.className = "config-row";
  row.dataset.type = type;
  const placeholder =
    type === "device" ? "Thermostat serial number" : "MyNuheat group name";
  row.innerHTML = `
    <label class="field">
      <span>${type === "device" ? "Serial Number" : "Group Name"}</span>
      <input class="row-value" type="text" placeholder="${placeholder}" value="${escapeAttribute(value)}" />
    </label>
    <div class="row-actions">
      <label class="row-checkbox">
        <input class="row-disabled" type="checkbox" ${disabled ? "checked" : ""} />
        Disabled
      </label>
      <button class="secondary remove-row" type="button">Remove</button>
    </div>
  `;

  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    ensureListPlaceholder(container, type);
    updateStatuses();
    renderDiagnostics();
  });
  row.querySelector(".row-value").addEventListener("input", () => {
    updateStatuses();
    renderDiagnostics();
  });
  row.querySelector(".row-disabled").addEventListener("change", () => {
    renderDiagnostics();
  });

  container.appendChild(row);
  updateStatuses();
  renderDiagnostics();
}

function ensureListPlaceholder(container, type) {
  if (container.querySelector(".config-row")) {
    return;
  }
  renderRows(container, type, []);
}

function collectRows(container, key) {
  return Array.from(container.querySelectorAll(".config-row"))
    .map((row) => {
      const value = row.querySelector(".row-value").value.trim();
      const disabled = row.querySelector(".row-disabled").checked;
      if (!value) {
        return null;
      }
      return { [key]: value, disabled };
    })
    .filter(Boolean);
}

async function saveAccount() {
  const email = elements.email.value.trim();
  const password = elements.password.value;

  if (!email) {
    showToast("error", "MyNuheat email is required.");
    elements.email.focus();
    return;
  }

  if (!state.hasPassword && !password) {
    showToast("error", "MyNuheat password is required for new configs.");
    elements.password.focus();
    return;
  }

  const patch = {
    platform: PLATFORM_NAME,
    email,
    Email: undefined,
  };

  if (password) {
    patch.password = password;
  }

  await persistPatch(patch);
  if (password) {
    state.hasPassword = true;
    elements.password.value = "";
    elements.password.placeholder = "Saved password (leave blank to keep)";
    updateStatuses();
    renderDiagnostics();
  }
  showToast("success", "Account settings saved.");
}

async function saveAccessories() {
  await persistPatch({
    devices: collectRows(elements.devicesList, "serialNumber"),
    groups: collectRows(elements.groupsList, "groupName"),
    autoPopulateAwayModeSwitches: Boolean(
      elements.autoPopulateAwayModeSwitches.checked,
    ),
    exposeScheduleSwitches: Boolean(elements.exposeScheduleSwitches.checked),
  });
  showToast("success", "Accessory settings saved.");
}

async function saveBehavior() {
  const holdLength = normalizeHoldLength(elements.holdLength.value);
  const refresh = normalizeRefresh(elements.refresh.value);

  elements.holdLength.value = String(holdLength);
  elements.refresh.value = String(refresh);

  await persistPatch({
    holdLength,
    refresh,
    enableNotifications: Boolean(elements.enableNotifications.checked),
    debug: Boolean(elements.debug.checked),
  });
  showToast("success", "Behavior settings saved.");
}

async function persistPatch(patch) {
  await withSpinner(async () => {
    if (!state.config) {
      state.config = createDefaultConfig();
      state.configs.push(state.config);
    }

    Object.keys(patch).forEach((key) => {
      if (patch[key] === undefined) {
        delete state.config[key];
      } else {
        state.config[key] = patch[key];
      }
    });

    if (
      window.homebridge &&
      typeof window.homebridge.updatePluginConfig === "function"
    ) {
      await window.homebridge.updatePluginConfig(state.configs);
      await window.homebridge.savePluginConfig();
    }

    updateStatuses();
    renderDiagnostics();
  });
}

function updateStatuses() {
  updateAuthStatus();
  updateAccessoryStatus();
  updateBehaviorStatus();
}

function updateAuthStatus() {
  setStatus(
    elements.authStatus,
    elements.email.value.trim() && state.hasPassword,
    elements.email.value.trim()
      ? state.hasPassword
        ? "Credentials saved"
        : "Password needed"
      : "Login needed",
  );
}

function updateAccessoryStatus() {
  const devices = collectRows(elements.devicesList, "serialNumber");
  const groups = collectRows(elements.groupsList, "groupName");
  const autoGroups = elements.autoPopulateAwayModeSwitches.checked;
  let text = "Auto discovery";
  let isGood = true;

  if (devices.length > 0) {
    text = `${devices.length} thermostat${devices.length === 1 ? "" : "s"}`;
  }
  if (autoGroups) {
    text += " + all groups";
  } else if (groups.length > 0) {
    text += ` + ${groups.length} group${groups.length === 1 ? "" : "s"}`;
  }
  if (devices.length > 0 || groups.length > 0) {
    isGood = false;
  }

  setStatus(elements.accessoryStatus, isGood, text);
}

function updateBehaviorStatus() {
  const notificationsEnabled = elements.enableNotifications.checked;
  setStatus(
    elements.behaviorStatus,
    notificationsEnabled,
    notificationsEnabled ? "Notifications on" : "Polling only",
  );
}

function setStatus(element, isGood, text) {
  element.textContent = text;
  element.classList.toggle("good", Boolean(isGood));
  element.classList.toggle("warn", !isGood);
}

function renderDiagnostics() {
  elements.diagnosticsList.innerHTML = "";
  const config = getDraftConfig();

  if (!config) {
    elements.diagnosticsSummary.textContent = "No Nuheat config loaded yet.";
    elements.diagnosticsEmpty.classList.remove("hidden");
    return;
  }

  elements.diagnosticsEmpty.classList.add("hidden");
  elements.diagnosticsSummary.textContent =
    "Configuration summary only. Restart Homebridge after saving to reconnect with these settings.";

  addDiagnosticCard("Account", [
    ["Platform", PLATFORM_NAME],
    ["Email", config.email || "not configured"],
    ["Password", state.hasPassword || elements.password.value ? "saved" : "missing"],
    ["API Access", "built-in Nuheat PKCE client"],
  ]);

  addDiagnosticCard("Accessories", [
    ["Thermostats", getThermostatSummary(config)],
    ["Away Groups", getGroupSummary(config)],
    [
      "Schedule Switches",
      config.exposeScheduleSwitches ? "enabled" : "disabled",
    ],
  ]);

  addDiagnosticCard("Behavior", [
    ["Hold Length", getHoldSummary(config.holdLength)],
    ["Polling", `${normalizeRefresh(config.refresh)} seconds`],
    [
      "Notifications",
      config.enableNotifications === false ? "disabled" : "enabled",
    ],
    ["Debug Logs", config.debug ? "enabled" : "disabled"],
  ]);
}

function addDiagnosticCard(title, rows) {
  const card = document.createElement("article");
  card.className = "diagnostic-card";
  card.innerHTML = `
    <div class="device-header">
      <h3>${escapeHtml(title)}</h3>
      <span class="pill good">Ready</span>
    </div>
    <dl>
      ${rows
        .map(
          ([label, value]) =>
            `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
        )
        .join("")}
    </dl>
  `;
  elements.diagnosticsList.appendChild(card);
}

function getDraftConfig() {
  return {
    ...(state.config || createDefaultConfig()),
    email: elements.email.value.trim(),
    devices: collectRows(elements.devicesList, "serialNumber"),
    groups: collectRows(elements.groupsList, "groupName"),
    autoPopulateAwayModeSwitches: Boolean(
      elements.autoPopulateAwayModeSwitches.checked,
    ),
    exposeScheduleSwitches: Boolean(elements.exposeScheduleSwitches.checked),
    holdLength: normalizeHoldLength(elements.holdLength.value),
    refresh: normalizeRefresh(elements.refresh.value),
    enableNotifications: Boolean(elements.enableNotifications.checked),
    debug: Boolean(elements.debug.checked),
  };
}

function getThermostatSummary(config) {
  const devices = Array.isArray(config.devices) ? config.devices : [];
  if (devices.length === 0) {
    return "all account thermostats";
  }
  const disabled = devices.filter((device) => device.disabled).length;
  return `${devices.length} listed${disabled ? `, ${disabled} disabled` : ""}`;
}

function getGroupSummary(config) {
  const groups = Array.isArray(config.groups) ? config.groups : [];
  if (config.autoPopulateAwayModeSwitches) {
    return "all account groups";
  }
  if (groups.length === 0) {
    return "not exposed";
  }
  const disabled = groups.filter((group) => group.disabled).length;
  return `${groups.length} listed${disabled ? `, ${disabled} disabled` : ""}`;
}

function getHoldSummary(value) {
  const holdLength = normalizeHoldLength(value);
  if (holdLength === 0) {
    return "until next scheduled event";
  }
  if (holdLength === 1440) {
    return "permanent hold";
  }
  return `${holdLength} minute timed hold`;
}

function normalizeHoldLength(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1440;
  }
  return Math.min(1440, Math.max(0, parsed));
}

function normalizeRefresh(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 60;
  }
  return Math.max(30, parsed);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function bindEvents() {
  elements.saveAccount.addEventListener("click", () => {
    saveAccount().catch(() => showToast("error", "Failed to save account."));
  });
  elements.saveAccessories.addEventListener("click", () => {
    saveAccessories().catch(() =>
      showToast("error", "Failed to save accessories."),
    );
  });
  elements.saveBehavior.addEventListener("click", () => {
    saveBehavior().catch(() => showToast("error", "Failed to save behavior."));
  });
  elements.addDevice.addEventListener("click", () => {
    addRow(elements.devicesList, "device");
  });
  elements.addGroup.addEventListener("click", () => {
    addRow(elements.groupsList, "group");
  });
  elements.refreshDiagnostics.addEventListener("click", renderDiagnostics);

  [
    elements.email,
    elements.password,
    elements.autoPopulateAwayModeSwitches,
    elements.exposeScheduleSwitches,
    elements.holdLength,
    elements.refresh,
    elements.enableNotifications,
    elements.debug,
  ].forEach((element) => {
    element.addEventListener("input", () => {
      updateStatuses();
      renderDiagnostics();
    });
    element.addEventListener("change", () => {
      updateStatuses();
      renderDiagnostics();
    });
  });
}

function init() {
  bindEvents();
  loadConfig().catch(() => {
    showToast("error", "Failed to load current config.");
  });
}

if (window.homebridge) {
  window.homebridge.addEventListener("ready", init);
} else {
  document.addEventListener("DOMContentLoaded", init);
}
