pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.plasma.components as PlasmaComponents
import org.kde.plasma.extras as PlasmaExtras

import "../code/quotaModel.js" as QuotaModel

PlasmaExtras.Representation {
    id: full

    property var windows: []
    property string errorText: ""
    property bool stale: false
    property bool refreshing: false
    property double nowMs: 0

    signal refreshRequested()

    readonly property string usageText: QuotaModel.usageLine(windows)

    implicitWidth: Kirigami.Units.gridUnit * 20
    implicitHeight: Kirigami.Units.gridUnit * 16

    header: PlasmaExtras.PlasmoidHeading {
        RowLayout {
            anchors.fill: parent
            spacing: Kirigami.Units.smallSpacing

            PlasmaComponents.Label {
                text: i18n("Uso de NaN")
                font.bold: true
            }

            Item {
                Layout.fillWidth: true
            }

            PlasmaComponents.ToolButton {
                icon.name: "view-refresh"
                enabled: !full.refreshing
                onClicked: full.refreshRequested()

                PlasmaComponents.ToolTip {
                    text: i18n("Actualizar ahora")
                }
            }
        }
    }

    contentItem: ColumnLayout {
        spacing: Kirigami.Units.smallSpacing

        Kirigami.InlineMessage {
            visible: full.errorText !== ""
            type: full.stale ? Kirigami.MessageType.Warning : Kirigami.MessageType.Error
            text: full.stale
                ? i18n("Mostrando datos en caché: %1", full.errorText)
                : full.errorText
            Layout.fillWidth: true
        }

        Repeater {
            model: full.windows

            delegate: ModelRow {
                required property var modelData
                Layout.fillWidth: true
                windowData: modelData
                nowMs: full.nowMs
            }
        }

        PlasmaComponents.Label {
            visible: full.windows.length === 0 && full.errorText === ""
            text: i18n("Todavía no hay datos de uso.")
            opacity: 0.7
        }

        Item {
            Layout.fillHeight: true
        }

        PlasmaComponents.Label {
            visible: full.usageText !== ""
            text: full.usageText
            opacity: 0.7
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignRight
        }

        PlasmaComponents.Button {
            Layout.fillWidth: true
            Layout.topMargin: Kirigami.Units.smallSpacing
            text: i18n("Panel de NaN")
            icon.name: "internet-services"
            onClicked: Qt.openUrlExternally("https://cloud.nan.builders/dashboard")
        }
    }
}
