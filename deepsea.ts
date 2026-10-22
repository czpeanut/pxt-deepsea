/**
 * 深海探險隊：給低年級的簡化積木
 * 一塊積木做完一件事。藍牙、讀取文字、比較、限制範圍、畫圖都藏在積木裡面。
 * 和 czpeanut.github.io/micro-remote 的潛艇遙控器、潛艇出航、深海探險、聲納尋寶搭配使用。
 */

enum SubCommand {
    //% block="前進"
    Forward = 0,
    //% block="後退"
    Back = 1,
    //% block="左轉"
    Left = 2,
    //% block="右轉"
    Right = 3
}

enum SubDir {
    //% block="上"
    Up = 0,
    //% block="下"
    Down = 1,
    //% block="左"
    Left = 2,
    //% block="右"
    Right = 3
}

enum SubAxis {
    //% block="x"
    X = 0,
    //% block="y"
    Y = 1
}

enum TiltDir {
    //% block="往左歪"
    Left = 0,
    //% block="往右歪"
    Right = 1,
    //% block="往前歪"
    Forward = 2,
    //% block="往後歪"
    Back = 3,
    //% block="平放"
    Flat = 4
}

enum WebMessage {
    //% block="找到寶藏"
    Found = 0,
    //% block="時間到"
    End = 1
}

//% color="#0E7C86" weight=100 icon="" block="深海探險"
//% groups='["第五課 潛艇出航", "第六課 傾斜駕駛", "第七課 聲納雷達", "第八課 雙屏尋寶"]'
namespace deepsea {
    // 0 不畫、1 海圖（第五課）、2 水平儀（第六課）、3 雷達（第七課）
    let mode = 0
    let started = false
    let size = 5
    let subX = 0
    let subY = 0
    let mineXs: number[] = []
    let mineYs: number[] = []
    let treasureX = 0
    let treasureY = 0
    let busy = false
    let cmdHandlers: (() => void)[] = [null, null, null, null]
    let hitHandler: () => void = null
    let foundHandler: () => void = null
    let radarHandler: () => void = null
    let lastStrength = 0
    let msgHandlers: (() => void)[] = [null, null]
    let tiltSending = false
    let tiltDriving = false
    let beeping = false
    let buttonSeaOn = false

    function ensure(): void {
        if (started) return
        started = true
        bluetooth.startUartService()
        bluetooth.onBluetoothConnected(function () {
            basic.showIcon(IconNames.Yes)
            basic.pause(300)
        })
        bluetooth.onBluetoothDisconnected(function () {
            basic.showIcon(IconNames.No)
        })
        bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
            const msg = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash))
            const cmds = "fblr"
            const i = cmds.indexOf(msg)
            if (msg.length == 1 && i >= 0) {
                if (buttonSeaOn) move(i == 0 ? SubDir.Up : i == 1 ? SubDir.Down : i == 2 ? SubDir.Left : SubDir.Right)
                if (cmdHandlers[i]) cmdHandlers[i]()
            } else if (msg == "g") {
                if (msgHandlers[0]) msgHandlers[0]()
            } else if (msg == "e") {
                if (msgHandlers[1]) msgHandlers[1]()
            } else if (msg.length > 0) {
                lastStrength = parseFloat(msg)
                if (radarHandler) radarHandler()
            }
        })
        basic.forever(function () {
            if (busy || mode == 0) return
            if (mode == 1) {
                basic.clearScreen()
                for (let k = 0; k < mineXs.length; k++) led.plotBrightness(mineXs[k], mineYs[k], 30)
                led.plot(subX, subY)
            } else if (mode == 2) {
                basic.clearScreen()
                led.plot(Math.map(input.acceleration(Dimension.X), -1023, 1023, 0, 4), Math.map(input.acceleration(Dimension.Y), -1023, 1023, 0, 4))
            } else if (mode == 3) {
                led.plotBarGraph(Math.constrain(10 - distance(), 0, 10), 10)
            }
            basic.pause(100)
        })
    }

    function isMine(x: number, y: number): boolean {
        for (let k = 0; k < mineXs.length; k++) if (mineXs[k] == x && mineYs[k] == y) return true
        return false
    }

    // 炸完之後，水雷搬到新的隨機位置（1～4，不會在起點 0, 0，也不和別顆水雷重疊）
    function moveMine(x: number, y: number): void {
        for (let k = 0; k < mineXs.length; k++) {
            if (mineXs[k] != x || mineYs[k] != y) continue
            let nx = 0, ny = 0
            for (let t = 0; t < 20; t++) {
                nx = randint(1, size - 1)
                ny = randint(1, size - 1)
                if (!isMine(nx, ny)) break
            }
            mineXs[k] = nx
            mineYs[k] = ny
            return
        }
    }

    function checkHit(): void {
        if (!isMine(subX, subY)) return
        busy = true
        bluetooth.uartWriteString("boom#")
        moveMine(subX, subY)
        if (hitHandler) hitHandler()
        busy = false
    }

    // 把潛艇座標（和雷達開著時的距離 d）傳給聲納尋寶網頁
    function sendSub(): void {
        bluetooth.uartWriteValue("x", subX)
        bluetooth.uartWriteValue("y", subY)
    }

    function checkFound(): void {
        if (distance() != 0) return
        busy = true
        if (beeping) basic.pause(100) // 等雷達嗶聲播完，再送 found#（送訊號同時播聲音會當機 070）
        bluetooth.uartWriteString("found#")
        if (foundHandler) foundHandler()
        hideTreasure()
        busy = false
    }

    // ---------------- 第五課 潛艇出航 ----------------

    /**
     * 打開藍牙。連上時顯示打勾，斷線時顯示打叉。
     */
    //% blockId=deepsea_start block="啟動潛艇遙控" group="第五課 潛艇出航" weight=100
    export function start(): void {
        ensure()
    }

    /**
     * 平板按下方向鍵時要做的事
     */
    //% blockId=deepsea_on_command block="當收到 %cmd" group="第五課 潛艇出航" weight=90
    export function onCommand(cmd: SubCommand, handler: () => void): void {
        ensure()
        mode = 1
        cmdHandlers[cmd] = handler
    }

    /**
     * 潛艇移動一格，不會開出海底。撞到水雷時會自動告訴網頁 boom#。
     */
    //% blockId=deepsea_move block="潛艇往 %dir 移動一格" group="第五課 潛艇出航" weight=80
    export function move(dir: SubDir): void {
        if (dir == SubDir.Up) subY--
        else if (dir == SubDir.Down) subY++
        else if (dir == SubDir.Left) subX--
        else subX++
        subX = Math.constrain(subX, 0, size - 1)
        subY = Math.constrain(subY, 0, size - 1)
        if (mode == 1) checkHit()
        if (size == 10) {
            sendSub()
            checkFound()
        }
    }

    /**
     * 在海底放一顆水雷（燈比較暗）
     */
    //% blockId=deepsea_mine block="放一顆水雷在 x %x y %y" group="第五課 潛艇出航" weight=70
    //% x.min=0 x.max=4 y.min=0 y.max=4 x.defl=4 y.defl=4
    export function placeMine(x: number, y: number): void {
        mineXs.push(x)
        mineYs.push(y)
    }

    /**
     * 潛艇和水雷在同一格時要做的事。撞到之後水雷會自動搬到新的位置。
     */
    //% blockId=deepsea_on_hit block="當撞到水雷" group="第五課 潛艇出航" weight=60
    export function onHitMine(handler: () => void): void {
        hitHandler = handler
    }

    /**
     * 把潛艇放到指定的位置
     */
    //% blockId=deepsea_goto block="潛艇回到 x %x y %y" group="第五課 潛艇出航" weight=50
    //% x.min=0 x.max=9 y.min=0 y.max=9
    export function goTo(x: number, y: number): void {
        subX = Math.constrain(x, 0, size - 1)
        subY = Math.constrain(y, 0, size - 1)
    }

    /**
     * 潛艇現在的座標
     */
    //% blockId=deepsea_pos block="潛艇的 %axis" group="第五課 潛艇出航" weight=40
    export function position(axis: SubAxis): number {
        return axis == SubAxis.X ? subX : subY
    }

    // ---------------- 第六課 傾斜駕駛 ----------------

    /**
     * 每 0.1 秒把傾斜的 x、y 傳給網頁，網頁上的潛艇就會跟著動
     */
    //% blockId=deepsea_send_tilt block="把傾斜傳給網頁" group="第六課 傾斜駕駛" weight=100
    export function sendTilt(): void {
        ensure()
        if (tiltSending) return
        tiltSending = true
        control.inBackground(function () {
            while (true) {
                bluetooth.uartWriteValue("x", input.acceleration(Dimension.X))
                bluetooth.uartWriteValue("y", input.acceleration(Dimension.Y))
                basic.pause(100)
            }
        })
    }

    /**
     * micro:bit 現在是不是往這個方向歪（歪超過一點點才算）
     */
    //% blockId=deepsea_tilted block="micro:bit %dir" group="第六課 傾斜駕駛" weight=90
    export function isTilted(dir: TiltDir): boolean {
        const ax = input.acceleration(Dimension.X)
        const ay = input.acceleration(Dimension.Y)
        if (dir == TiltDir.Left) return ax < -300
        if (dir == TiltDir.Right) return ax > 300
        if (dir == TiltDir.Forward) return ay < -300
        if (dir == TiltDir.Back) return ay > 300
        return Math.abs(ax) <= 300 && Math.abs(ay) <= 300
    }

    /**
     * LED 變成水平儀：傾斜時，燈點會滑到低的那一邊（中高年級用，低年級版不顯示）
     */
    //% blockId=deepsea_level block="顯示水平儀" group="第六課 傾斜駕駛" weight=80 blockHidden=true
    export function showLevel(): void {
        ensure()
        mode = 2
    }

    // ---------------- 第七課 聲納雷達 ----------------

    /**
     * 海底變成 10×10。按聲納尋寶網頁上的方向鍵，潛艇就走一格，
     * micro:bit 會把座標（和雷達開著時的距離）傳回網頁。
     */
    //% blockId=deepsea_button_sea block="開進 10×10 大海（平板按鈕開）" group="第七課 聲納雷達" weight=100
    export function buttonSea(): void {
        ensure()
        size = 10
        subX = 5
        subY = 5
        buttonSeaOn = true
    }

    /**
     * 舊版：傾斜開潛艇（10×10 大海）。新的課程改用「開進 10×10 大海（平板按鈕開）」。
     */
    //% blockId=deepsea_tilt_drive block="用傾斜開潛艇（10×10 大海）" group="第七課 聲納雷達" weight=99 blockHidden=true
    export function tiltDrive(): void {
        ensure()
        size = 10
        subX = 5
        subY = 5
        if (tiltDriving) return
        tiltDriving = true
        control.inBackground(function () {
            while (true) {
                const ax = input.acceleration(Dimension.X)
                const ay = input.acceleration(Dimension.Y)
                if (ax < -300) move(SubDir.Left)
                else if (ax > 300) move(SubDir.Right)
                if (ay < -300) move(SubDir.Up)
                else if (ay > 300) move(SubDir.Down)
                bluetooth.uartWriteValue("x", subX)
                bluetooth.uartWriteValue("y", subY)
                basic.pause(300)
            }
        })
    }

    /**
     * 把寶藏藏在 10×10 海底的隨機位置
     */
    //% blockId=deepsea_hide block="把寶藏藏起來" group="第七課 聲納雷達" weight=90
    export function hideTreasure(): void {
        treasureX = randint(0, 9)
        treasureY = randint(0, 9)
    }

    /**
     * 潛艇要走幾步才到寶藏：左右差幾格 + 上下差幾格
     */
    //% blockId=deepsea_distance block="離寶藏的距離" group="第七課 聲納雷達" weight=80
    export function distance(): number {
        return Math.abs(subX - treasureX) + Math.abs(subY - treasureY)
    }

    /**
     * LED 變成雷達長條圖：寶藏在 10 格以內，越近越滿
     */
    //% blockId=deepsea_radar block="顯示雷達" group="第七課 聲納雷達" weight=70 blockHidden=true
    export function showRadar(): void {
        ensure()
        mode = 3
    }

    /**
     * 越近嗶得越快，10 格以外不叫（micro:bit 喇叭）
     */
    //% blockId=deepsea_beep block="開啟雷達嗶嗶聲" group="第七課 聲納雷達" weight=60
    export function radarBeep(): void {
        if (beeping) return
        beeping = true
        control.inBackground(function () {
            while (true) {
                const d = distance()
                if (d < 10 && !busy) {
                    music.playTone(1319, music.beat(BeatFraction.Sixteenth))
                    basic.pause(d * 100)
                } else {
                    basic.pause(200)
                }
            }
        })
    }

    /**
     * 潛艇開到寶藏上時要做的事。會自動告訴網頁 found#，再把寶藏藏到新的地方。
     */
    //% blockId=deepsea_on_found block="當找到寶藏" group="第七課 聲納雷達" weight=50
    export function onFound(handler: () => void): void {
        foundHandler = handler
    }

    // ---------------- 第八課 雙屏尋寶 ----------------

    /**
     * 網頁傳來雷達強度（0～4）的時候
     */
    //% blockId=deepsea_on_radar block="當收到網頁的雷達強度" group="第八課 雙屏尋寶" weight=100
    export function onRadar(handler: () => void): void {
        ensure()
        radarHandler = handler
    }

    /**
     * 網頁最後一次傳來的雷達強度（0～4）
     */
    //% blockId=deepsea_strength block="雷達強度" group="第八課 雙屏尋寶" weight=95
    export function strength(): number {
        return lastStrength
    }

    /**
     * 用長條圖畫出雷達強度（0～4）
     */
    //% blockId=deepsea_draw_radar block="畫雷達 強度 %n" group="第八課 雙屏尋寶" weight=90
    //% n.min=0 n.max=4
    export function drawRadar(n: number): void {
        mode = 0
        led.plotBarGraph(n, 4)
    }

    /**
     * 網頁說找到寶藏（g#）或時間到（e#）的時候
     */
    //% blockId=deepsea_on_web block="當網頁說 %msg" group="第八課 雙屏尋寶" weight=80
    export function onWebMessage(msg: WebMessage, handler: () => void): void {
        ensure()
        msgHandlers[msg] = handler
    }

    /**
     * 發射聲納：網頁上的寶藏會亮一下（只能用 3 次）
     */
    //% blockId=deepsea_ping block="發射聲納" group="第八課 雙屏尋寶" weight=70
    export function sonarPing(): void {
        ensure()
        bluetooth.uartWriteString("p#")
    }
}
