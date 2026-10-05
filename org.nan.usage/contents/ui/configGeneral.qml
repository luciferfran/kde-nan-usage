pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts

import org.kde.kcmutils as KCM
import org.kde.kirigami as Kirigami
import org.kde.plasma.core as PlasmaCore

KCM.SimpleKCM {
    id: root

    property alias cfg_keyPath: keyPathField.text
    property alias cfg_pollSeconds: pollSecondsSpin.value
    property alias cfg_panelModel: panelModelCombo.currentValue
    property alias cfg_panelModelId: panelModelIdField.text
    property alias cfg_panelGauge: panelGaugeCombo.currentValue
    property alias cfg_showIcon: showIconCheck.checked
    property alias cfg_showPercentage: showPercentageCheck.checked
    property alias cfg_showReset: showResetCheck.checked
    property alias cfg_hideUnused: hideUnusedCheck.checked
    property alias cfg_showMetrics: showMetricsCheck.checked

    Kirigami.FormLayout {
        QQC2.TextField {
            id: keyPathField
            Kirigami.FormData.label: i18n("Fichero de API key:")
            placeholderText: "~/.config/nan/api-key"
            Layout.fillWidth: true
        }

        QQC2.SpinBox {
            id: pollSecondsSpin
            Kirigami.FormData.label: i18n("Intervalo de sondeo (segundos):")
            from: 60
            to: 1800
            stepSize: 30
        }

        QQC2.ComboBox {
            id: panelModelCombo
            Kirigami.FormData.label: i18n("Modelo del panel:")
            textRole: "text"
            valueRole: "value"
            model: [
                {text: i18n("Peor"), value: "worst"},
                {text: i18n("Mayor uso"), value: "max"},
                {text: i18n("Fijo"), value: "fixed"},
            ]
        }

        QQC2.TextField {
            id: panelModelIdField
            Kirigami.FormData.label: i18n("Id del modelo fijo:")
            placeholderText: "deepseek-v4-flash"
            Layout.fillWidth: true
        }

        QQC2.ComboBox {
            id: panelGaugeCombo
            Kirigami.FormData.label: i18n("Indicador del panel:")
            textRole: "text"
            valueRole: "value"
            model: [
                {text: i18n("Anillo"), value: "ring"},
                {text: i18n("Barra"), value: "bar"},
                {text: i18n("Ninguno"), value: "none"},
            ]
        }

        Item {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Contenido del panel")
        }

        QQC2.CheckBox {
            id: showIconCheck
            text: i18n("Mostrar icono")
        }

        QQC2.CheckBox {
            id: showPercentageCheck
            text: i18n("Mostrar porcentaje")
        }

        QQC2.CheckBox {
            id: showResetCheck
            text: i18n("Mostrar tiempo hasta el reset")
        }

        Item {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Popup")
        }

        QQC2.CheckBox {
            id: hideUnusedCheck
            text: i18n("Ocultar modelos sin uso")
        }

        QQC2.CheckBox {
            id: showMetricsCheck
            text: i18n("Mostrar consumo agregado (24 h, mes, 30 días)")
        }
    }
}
