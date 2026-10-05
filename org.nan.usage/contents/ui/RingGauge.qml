pragma ComponentBehavior: Bound

import QtQuick

import org.kde.kirigami as Kirigami

Item {
    id: gauge

    implicitWidth: Kirigami.Units.iconSizes.smallMedium
    implicitHeight: Kirigami.Units.iconSizes.smallMedium

    // Current value, 0..100.
    property real value: 0
    property color valueColor: Kirigami.Theme.highlightColor
    property color trackColor: Kirigami.Theme.disabledTextColor
    property real lineWidth: Math.max(2, Math.min(width, height) / 8)

    function repaint() {
        canvas.requestPaint();
    }

    onValueChanged: repaint()
    onWidthChanged: repaint()
    onHeightChanged: repaint()
    onValueColorChanged: repaint()
    onTrackColorChanged: repaint()
    onLineWidthChanged: repaint()

    Canvas {
        id: canvas
        anchors.fill: parent
        antialiasing: true

        onPaint: {
            const ctx = getContext("2d");
            ctx.reset();

            const size = Math.min(width, height);
            const cx = width / 2;
            const cy = height / 2;
            const radius = Math.max(0, (size - gauge.lineWidth) / 2);
            if (radius <= 0)
                return;

            const start = -Math.PI / 2;
            const full = Math.PI * 2;

            // Background track.
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, full);
            ctx.lineWidth = gauge.lineWidth;
            ctx.strokeStyle = gauge.trackColor;
            ctx.stroke();

            // Value arc. Clamp so an overshoot does not wrap around.
            const fraction = Math.max(0, Math.min(1, gauge.value / 100));
            if (fraction > 0) {
                ctx.beginPath();
                ctx.arc(cx, cy, radius, start, start + full * fraction);
                ctx.lineWidth = gauge.lineWidth;
                ctx.lineCap = "round";
                ctx.strokeStyle = gauge.valueColor;
                ctx.stroke();
            }
        }
    }
}
