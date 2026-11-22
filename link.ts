/**
 * 酷丁狐連線（接收端）
 * 沒有積木，學生看不到。只要專案用了深海探險擴展，這段程式就會一起下載進 micro:bit。
 *
 * 兩種模式：
 *  遊戲模式（平常開機）：學生自己寫的程式照常執行；藍牙開著，等網頁來問。
 *  接收端模式（網頁接管後）：學生的程式不啟動，LED 和按鈕全部交給網頁（第七、八堂）。
 *
 * 切換方式：網頁送 KDWEB# → micro:bit 記下「下次開機當接收端」→ 自動重新開機。
 * 這個記號只用一次：拔電、按背面重設鈕，就回到學生自己的遊戲。
 *
 * 網頁 → micro:bit（# 結尾）
 *  V?        問版本，回 VG1#（遊戲模式）或 VW1#（接收端模式）
 *  KDWEB     切到接收端模式（會重新開機）
 *  L+25 碼   整個畫面，每碼 0～9 是亮度，由左上往右、一列一列
 *  C         清空畫面
 *  T1 / T0   開始／停止每 0.1 秒回報傾斜
 *  S+文字    捲動顯示文字
 *  BYE       回到遊戲模式（重新開機）
 * micro:bit → 網頁（# 結尾）
 *  A、B、AB  按下按鈕；G 搖晃；P 碰觸標誌；Tx,y 傾斜（加速度 x、y）
 */
namespace kdlink {
    const FLAG = "kdweb"
    export const VERSION = 1
    let uartOn = false
    let forward: (msg: string) => void = null
    let webMode = false
    let connected = false
    let tilt = false
    let lastSeen = 0

    function send(s: string): void {
        if (connected) bluetooth.uartWriteString(s + "#")
    }

    /** 藍牙只開一次；深海探險的積木也透過這裡收訊息 */
    export function ensureUart(): void {
        if (uartOn) return
        uartOn = true
        bluetooth.startUartService()
        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
            const msg = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
            lastSeen = control.millis()
            if (msg == "V?") {
                bluetooth.uartWriteString((webMode ? "VW" : "VG") + VERSION + "#")
            } else if (msg == "KDWEB") {
                if (webMode) bluetooth.uartWriteString("VW" + VERSION + "#")
                else {
                    settings.writeNumber(FLAG, 1)
                    basic.pause(100)
                    control.reset()
                }
            } else if (webMode) {
                handleWeb(msg)
            } else if (forward) {
                forward(msg)
            }
        })
    }

    /** 深海探險擴展用：遊戲模式時，把其他訊息轉給它 */
    export function onMessage(handler: (msg: string) => void): void {
        forward = handler
        ensureUart()
    }

    /** 現在是不是接收端模式 */
    export function isWebMode(): boolean {
        return webMode
    }

    function handleWeb(msg: string): void {
        const c = msg.charAt(0)
        if (c == "L" && msg.length >= 26) {
            for (let i = 0; i < 25; i++) {
                const v = parseInt(msg.charAt(i + 1))
                const x = i % 5
                const y = Math.idiv(i, 5)
                if (v > 0) led.plotBrightness(x, y, Math.min(255, v * 28 + 3))
                else led.unplot(x, y)
            }
        } else if (msg == "C") {
            basic.clearScreen()
        } else if (msg == "T1") {
            tilt = true
        } else if (msg == "T0") {
            tilt = false
        } else if (c == "S") {
            const text = msg.substr(1)
            control.inBackground(function () {
                basic.showString(text)
            })
        } else if (msg == "BYE") {
            basic.pause(100)
            control.reset()
        }
    }

    // 接收端模式：永遠不結束，所以學生的程式（排在後面）不會啟動
    function runReceiver(): void {
        webMode = true
        lastSeen = control.millis()
        bluetooth.onBluetoothConnected(function () {
            connected = true
            lastSeen = control.millis()
        })
        bluetooth.onBluetoothDisconnected(function () {
            connected = false
            tilt = false
            lastSeen = control.millis()
        })
        ensureUart()
        input.onButtonPressed(Button.A, function () { send("A") })
        input.onButtonPressed(Button.B, function () { send("B") })
        input.onButtonPressed(Button.AB, function () { send("AB") })
        input.onGesture(Gesture.Shake, function () { send("G") })
        input.onLogoEvent(TouchButtonEvent.Pressed, function () { send("P") })
        // 等網頁連回來的時候，中間亮一個點
        basic.clearScreen()
        led.plot(2, 2)
        while (true) {
            if (connected && tilt) {
                send("T" + input.acceleration(Dimension.X) + "," + input.acceleration(Dimension.Y))
            }
            // 斷線超過 1 分鐘沒連回來，就回到學生的遊戲
            if (!connected && control.millis() - lastSeen > 60000) control.reset()
            basic.pause(100)
        }
    }

    // ---- 開機時決定模式 ----
    if (settings.exists(FLAG)) {
        settings.remove(FLAG)
        runReceiver()
    } else {
        ensureUart()
    }
}
