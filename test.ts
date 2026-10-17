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
