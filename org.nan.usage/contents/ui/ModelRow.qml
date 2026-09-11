pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.plasma.components as PlasmaComponents

import "../code/quotaModel.js" as QuotaModel

ColumnLayout {
    id: row

    property var windowData: null
    property double nowMs: 0

    readonly property real pct: windowData ? windowData.utilization : 0
    readonly property string note: windowData ? QuotaModel.projectionNote(windowData, nowMs) : ""

    RowLayout {
        Layout.fillWidth: true
        spacing: Kirigami.Units.smallSpacing

        PlasmaComponents.Label {
            text: row.windowData ? row.windowData.model : ""
            font.bold: true
            elide: Text.ElideRight
            Layout.fillWidth: true
        }

        PlasmaComponents.Label {
            text: row.windowData
                ? QuotaModel.fmtTokens(row.windowData.used) + " / " + QuotaModel.fmtTokens(row.windowData.cap)
                : ""
            opacity: 0.8
        }

        PlasmaComponents.Label {
            text: row.windowData ? QuotaModel.fmtPct(row.windowData.utilization, true) : ""
        }
    }

    PlasmaComponents.ProgressBar {
        Layout.fillWidth: true
        from: 0
        to: 100
        value: Math.max(0, Math.min(100, row.pct))
    }

    PlasmaComponents.Label {
        visible: row.note !== ""
        text: row.note
        font: Kirigami.Theme.smallFont
        opacity: 0.7
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
    }
}
