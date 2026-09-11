pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Layouts

import org.kde.kirigami as Kirigami
import org.kde.plasma.components as PlasmaComponents

Item {
    id: compact

    property bool showIcon: true
    property string panelGauge: "ring"
    property bool showPercentage: true
    property bool showReset: true
    // True when the containment forces square applets (the system tray does).
    property bool square: false

    property var panelWindow: null
    property string level: "ok"
    property real utilization: 0
    property string resetText: ""
    property bool stale: false

    implicitWidth: square ? Kirigami.Units.iconSizes.smallMedium : layout.implicitWidth
    implicitHeight: square ? Kirigami.Units.iconSizes.smallMedium : layout.implicitHeight

    // The containment sizes applets from the representation's Layout hints, not
    // only from implicitWidth. Pin them so the widget reserves its full width
    // instead of overlapping its neighbours in the panel.
    Layout.minimumWidth: implicitWidth
    Layout.preferredWidth: implicitWidth
    Layout.maximumWidth: implicitWidth
    Layout.minimumHeight: implicitHeight
    Layout.preferredHeight: implicitHeight
    Layout.maximumHeight: implicitHeight

    function levelColor(lvl) {
        switch (lvl) {
        case "crit":
            return Kirigami.Theme.negativeTextColor;
        case "warn":
            return Kirigami.Theme.neutralTextColor;
        default:
            return Kirigami.Theme.positiveTextColor;
        }
    }

    // Wide form: icon, gauge, percentage and reset time (panels).
    RowLayout {
        id: layout
        visible: !compact.square
        anchors.fill: parent
        spacing: Kirigami.Units.smallSpacing

        Image {
            visible: compact.showIcon
            source: Qt.resolvedUrl("../icons/nan.svg")
            sourceSize.width: Kirigami.Units.iconSizes.smallMedium
            sourceSize.height: Kirigami.Units.iconSizes.smallMedium
            Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
            Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
            opacity: compact.stale ? 0.5 : 1.0
            fillMode: Image.PreserveAspectFit
        }

        RingGauge {
            visible: compact.panelWindow !== null && compact.panelGauge === "ring"
            Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
            Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
            value: compact.utilization
            valueColor: compact.levelColor(compact.level)
        }

        Item {
            visible: compact.panelWindow !== null && compact.panelGauge === "bar"
            implicitWidth: Kirigami.Units.gridUnit * 3
            implicitHeight: Math.max(4, Kirigami.Units.smallSpacing)
            Layout.preferredWidth: implicitWidth
            Layout.preferredHeight: implicitHeight

            Rectangle {
                anchors.fill: parent
                radius: height / 2
                color: Kirigami.Theme.disabledTextColor
                opacity: 0.3
            }

            Rectangle {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: parent.width * Math.max(0, Math.min(1, compact.utilization / 100))
                radius: height / 2
                color: compact.levelColor(compact.level)
            }
        }

        PlasmaComponents.Label {
            visible: compact.panelWindow !== null && compact.showPercentage
            text: Math.round(compact.utilization) + "%"
            color: compact.levelColor(compact.level)
        }

        PlasmaComponents.Label {
            visible: compact.panelWindow !== null && compact.showReset && compact.resetText !== ""
            text: compact.resetText
        }
    }

    // Square form: the icon with a level ring around it (system tray).
    Item {
        visible: compact.square
        anchors.fill: parent

        RingGauge {
            anchors.fill: parent
            lineWidth: 3
            value: compact.utilization
            valueColor: compact.levelColor(compact.level)
        }

        Image {
            anchors.centerIn: parent
            visible: compact.showIcon
            width: Kirigami.Units.iconSizes.small
            height: Kirigami.Units.iconSizes.small
            source: Qt.resolvedUrl("../icons/nan.svg")
            sourceSize.width: width
            sourceSize.height: height
            opacity: compact.stale ? 0.5 : 1.0
            fillMode: Image.PreserveAspectFit
        }
    }
}
