# 深海探險隊（pxt-deepsea）

魔法科學班「酷丁狐的科技實驗室」主題1 第五～八堂的低年級簡化積木。
一塊積木做完一件事：藍牙、讀取文字、比較、限制範圍、畫圖都藏在積木裡面。

搭配網頁：https://czpeanut.github.io/micro-remote/

## 加入擴展

MakeCode → 擴展 → 在搜尋框貼上 `https://github.com/czpeanut/pxt-deepsea`。
加入時如果問要不要移除「廣播」，選移除。擴展已經設定好「不需配對」，不用再改專案設定。

## 積木

| 課 | 積木 |
|---|---|
| 第五課 潛艇出航 | 啟動潛艇遙控、當收到［前進／後退／左轉／右轉］、潛艇往［上／下／左／右］移動一格、放一顆水雷在 x y、當撞到水雷、潛艇回到 x y、潛艇的 x／y |
| 第六課 傾斜駕駛 | 把傾斜傳給網頁、顯示水平儀 |
| 第七課 聲納雷達 | 開進 10×10 大海（平板按鈕開）、把寶藏藏起來、離寶藏的距離、顯示雷達、開啟雷達嗶嗶聲（電腦發聲）、當找到寶藏 |
| 第八課 雙屏尋寶 | 當收到網頁的雷達強度、雷達強度、畫雷達 強度、當網頁說［找到寶藏／時間到］、發射聲納 |

撞到水雷時自動送 `boom#`（水雷會自動搬到新的隨機位置，不會在起點 (0, 0)）、找到寶藏時自動送 `found#` 給網頁。

## 第五課範例

```blocks
deepsea.start()
deepsea.placeMine(4, 4)
deepsea.onCommand(SubCommand.Forward, function () {
    deepsea.move(SubDir.Up)
})
deepsea.onCommand(SubCommand.Back, function () {
    deepsea.move(SubDir.Down)
})
deepsea.onCommand(SubCommand.Left, function () {
    deepsea.move(SubDir.Left)
})
deepsea.onCommand(SubCommand.Right, function () {
    deepsea.move(SubDir.Right)
})
deepsea.onHitMine(function () {
    music.playTone(131, music.beat(BeatFraction.Half))
    basic.showIcon(IconNames.Square)
    basic.showIcon(IconNames.SmallSquare)
    deepsea.goTo(0, 0)
})
```

#### Metadata (used for search, rendering)

* for PXT/microbit

## 注意：藍牙連線時不要播聲音

micro:bit V2 連著藍牙時播放聲音，可能會當機（哭臉＋070，藍牙底層 SoftDevice 錯誤）。所以這個擴展裡沒有任何聲音：雷達嗶嗶聲是把距離 `d` 傳給聲納尋寶網頁，由電腦發聲。
