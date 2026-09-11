pragma ComponentBehavior: Bound

import QtQuick

import org.kde.kirigami as Kirigami
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasmoid
import org.kde.plasma.plasma5support as P5Support

import "../code/nanClient.js" as NanClient
import "../code/quotaModel.js" as QuotaModel

PlasmoidItem {
    id: root

    // --- Quota state ---
    property var windows: []
    property var metrics: null
    property var account: null
    property string apiKey: ""
    // Holds either the special marker "nokey" or a user-facing message.
    property string apiErrorMessage: ""
    property bool stale: false
    property bool refreshing: false
    property bool keyReading: false
    property bool keyReadPending: false
    property double lastSuccessMs: 0
    property double lastRequestMs: 0

    // Ticks so time-based bindings refresh without a network request.
    property double nowMs: Date.now()

    // --- Configuration mirrors (react to changes from the config dialog) ---
    property string cfgKeyPath: Plasmoid.configuration.keyPath
    property int cfgPollSeconds: Plasmoid.configuration.pollSeconds
    property bool cfgShowMetrics: Plasmoid.configuration.showMetrics

    onCfgKeyPathChanged: root.readKey()
    onCfgPollSecondsChanged: root.restartPollTimer()
    onCfgShowMetricsChanged: {
        if (root.cfgShowMetrics)
            root.fetchMetrics();
    }

    // --- Derived panel state ---
    readonly property var panelWindow: QuotaModel.selectPanelWindow(
        root.windows,
        Plasmoid.configuration.panelModel,
        Plasmoid.configuration.panelModelId,
        root.nowMs)
    readonly property string level: root.panelWindow
        ? QuotaModel.windowLevel(root.panelWindow, root.nowMs)
        : "ok"
    readonly property real utilization: root.panelWindow
        ? root.panelWindow.utilization
        : 0
    readonly property double resetMs: (root.panelWindow && root.panelWindow.resetsAt)
        ? Math.max(0, root.panelWindow.resetsAt - root.nowMs)
        : 0
    readonly property string resetText: root.resetMs > 0
        ? QuotaModel.humanDuration(root.resetMs, true)
        : ""
    readonly property string errorText: root.apiErrorMessage === "nokey"
        ? i18n("No se encontró la API key en %1", root.cfgKeyPath)
        : root.apiErrorMessage

    // --- Timers ---
    Timer {
        id: tickTimer
        interval: 30000
        running: true
        repeat: true
        onTriggered: root.nowMs = Date.now()
    }

    Timer {
        id: pollTimer
        repeat: true
        running: false
        onTriggered: root.poll(false)
    }

    Timer {
        id: cooldownTimer
        repeat: false
        onTriggered: root.poll(true)
    }

    function restartPollTimer() {
        pollTimer.interval = Math.max(60, root.cfgPollSeconds) * 1000;
        pollTimer.restart();
    }

    // --- API key file ---
    P5Support.DataSource {
        id: keySource
        engine: "executable"

        onNewData: function (sourceName, data) {
            keySource.disconnectSource(sourceName);
            root.keyReading = false;

            var key = String(data.stdout || "").trim();
            if (key.length === 0) {
                root.apiKey = "";
                root.apiErrorMessage = "nokey";
                root.stale = false;
                root.windows = [];
            } else {
                root.apiKey = key;
                root.apiErrorMessage = "";
                root.poll(true);
            }

            if (root.keyReadPending) {
                root.keyReadPending = false;
                root.readKey();
            }
        }
    }

    function readKey() {
        if (root.keyReading) {
            root.keyReadPending = true;
            return;
        }
        root.keyReading = true;
        keySource.connectSource(NanClient.keyCommand(root.cfgKeyPath));
    }

    // --- Network ---
    function poll(force) {
        if (root.apiKey === "") {
            root.readKey();
            return;
        }

        var now = Date.now();
        var elapsed = now - root.lastRequestMs;
        if (elapsed < 30000) {
            if (force) {
                cooldownTimer.interval = 30000 - elapsed;
                cooldownTimer.restart();
            }
            return;
        }

        root.lastRequestMs = now;
        root.refreshing = true;

        NanClient.fetchQuota(root.apiKey, function (quota) {
            root.windows = QuotaModel.normalizeQuota(quota, Date.now());
            root.apiErrorMessage = "";
            root.stale = false;
            root.refreshing = false;
            root.lastSuccessMs = Date.now();
            root.nowMs = Date.now();
            if (root.cfgShowMetrics)
                root.fetchMetrics();
            root.fetchAccount();
        }, function (err) {
            root.apiErrorMessage = NanClient.describeError(err);
            root.stale = root.windows.length > 0;
            root.refreshing = false;
        });
    }

    function fetchMetrics() {
        if (root.apiKey === "")
            return;
        NanClient.fetchMetrics(root.apiKey, function (data) {
            root.metrics = data;
        }, function () {
            // Aggregated metrics are optional: ignore failures.
        });
    }

    function fetchAccount() {
        if (root.apiKey === "" || root.account)
            return;
        NanClient.fetchMe(root.apiKey, function (data) {
            root.account = data;
        }, function () {
            // Account details are optional: ignore failures.
        });
    }

    // --- Lifecycle ---
    Component.onCompleted: {
        root.restartPollTimer();
        root.readKey();
    }

    // --- Presentation ---
    Plasmoid.title: i18n("Uso de NaN")
    toolTipMainText: i18n("Uso de NaN")
    toolTipSubText: root.panelWindow
        ? i18n("%1: %2 en uso", QuotaModel.shortModel(root.panelWindow.model),
               QuotaModel.fmtPct(root.panelWindow.utilization))
        : root.errorText

    compactRepresentation: CompactRepresentation {
        square: (Plasmoid.containmentDisplayHints
            & PlasmaCore.Types.ContainmentForcesSquarePlasmoids) !== 0
        showIcon: Plasmoid.configuration.showIcon
        panelGauge: Plasmoid.configuration.panelGauge
        showPercentage: Plasmoid.configuration.showPercentage
        showReset: Plasmoid.configuration.showReset
        panelWindow: root.panelWindow
        level: root.level
        utilization: root.utilization
        resetText: root.resetText
        stale: root.apiErrorMessage !== ""
            || root.stale
            || (root.lastSuccessMs > 0
                && root.nowMs - root.lastSuccessMs > 3 * root.cfgPollSeconds * 1000)
    }

    fullRepresentation: FullRepresentation {
        windows: root.windows
        metrics: root.metrics
        account: root.account
        errorText: root.errorText
        stale: root.stale
        refreshing: root.refreshing
        nowMs: root.nowMs
        onRefreshRequested: root.poll(true)
    }

    switchWidth: Kirigami.Units.gridUnit * 12
    switchHeight: Kirigami.Units.gridUnit * 6
    preferredRepresentation: Plasmoid.formFactor === PlasmaCore.Types.Planar
        ? fullRepresentation
        : null
}
