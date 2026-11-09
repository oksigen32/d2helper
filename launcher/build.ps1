# Builds icon.png / icon.ico and D2Helper.exe (uses the C# compiler built into Windows)
$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.Drawing

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}
function Poly($g, $brush, $pts, $s, $o) {
  $arr = @(); for ($i = 0; $i -lt $pts.Length; $i += 2) { $arr += New-Object System.Drawing.PointF(($pts[$i] * $s + $o), ($pts[$i + 1] * $s + $o)) }
  $g.FillPolygon($brush, [System.Drawing.PointF[]]$arr)
}

$S = 256
$bmp = New-Object System.Drawing.Bitmap $S, $S, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.Clear([System.Drawing.Color]::Transparent)
$rect = New-RoundRect 8 8 240 240 56
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 256, 256), [System.Drawing.Color]::FromArgb(255, 240, 88, 64), [System.Drawing.Color]::FromArgb(255, 150, 30, 18))
$g.FillPath($bg, $rect)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 255, 255, 255))
$soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 255, 236, 200))
$s = 5.2; $o = 128 - 16 * $s
Poly $g $white @(4, 4, 12, 4, 28, 20, 28, 28, 20, 28, 4, 12) $s $o
Poly $g $soft @(28, 4, 28, 12, 22, 18, 14, 10, 20, 4) $s $o
Poly $g $soft @(4, 28, 4, 20, 10, 14, 18, 22, 12, 28) $s $o
$g.Dispose()
$png = Join-Path $app 'icon.png'
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()

# ICO with embedded PNG (256x256)
$bytes = [IO.File]::ReadAllBytes($png)
$ms = New-Object IO.MemoryStream; $w = New-Object IO.BinaryWriter $ms
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)
$w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0)
$w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$bytes.Length); $w.Write([UInt32]22)
$w.Write($bytes); $w.Flush()
$ico = Join-Path $app 'icon.ico'
[IO.File]::WriteAllBytes($ico, $ms.ToArray())

$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /codepage:65001 /optimize+ /reference:System.Windows.Forms.dll "/win32icon:$ico" "/out:$(Join-Path $app 'D2Helper.exe')" (Join-Path $PSScriptRoot 'D2Helper.cs')
if ($LASTEXITCODE -ne 0) { throw "csc failed" }
Write-Host "OK: D2Helper.exe built"
