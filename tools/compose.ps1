/* 用 System.Drawing 把两张棋盘截图拼成一张对比图 */
Add-Type -AssemblyName System.Drawing

$root = "D:\Programs\deepseek\game\xiangqi"
$crop = New-Object System.Drawing.Rectangle(88, 88, 736, 740)   # board-wrap 区域
$outW = 640; $outH = [int](740 * $outW / 736)

$canvas = New-Object System.Drawing.Bitmap(($outW * 2 + 60), ($outH + 96))
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(13, 17, 23))

$font = New-Object System.Drawing.Font("Microsoft YaHei", 17, [System.Drawing.FontStyle]::Bold)
$fontS = New-Object System.Drawing.Font("Microsoft YaHei", 12)
$b1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 208, 154))
$b2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(147, 161, 177))

$items = @(
  @{ file = "_free.png"; title = "马不蹩腿（本作）"; sub = "同一匹马：3 个落点" },
  @{ file = "_classic.png"; title = "经典规则 · 蹩马腿"; sub = "同一匹马：2 个落点（被自己的象堵住）" }
)

for ($i = 0; $i -lt 2; $i++) {
  $it = $items[$i]
  $x = 20 + $i * ($outW + 20)
  $src = [System.Drawing.Image]::FromFile((Join-Path $root $it.file))
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle($x, 78, $outW, $outH)), $crop, 'Pixel')
  $src.Dispose()
  $g.DrawString($it.title, $font, $b1, ($x + 4), 18)
  $g.DrawString($it.sub, $fontS, $b2, ($x + 4), 50)
}

$canvas.Save((Join-Path $root "screenshots\compare.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $canvas.Dispose()
"ok"
