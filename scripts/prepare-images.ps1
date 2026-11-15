Add-Type -AssemblyName System.Drawing

$src = "ExtraUI\src\assets\images"
$dst = "public\images"
New-Item -ItemType Directory -Force -Path $dst | Out-Null

function Resize-Jpeg($in, $out, $maxW, $quality) {
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $in))
    $scale = [Math]::Min(1.0, $maxW / $img.Width)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)
    $bmp.Save((Join-Path (Resolve-Path $dst) $out), $enc, $ep)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    Write-Output ("{0} -> {1} ({2}x{3})" -f (Split-Path $in -Leaf), $out, $w, $h)
}

Resize-Jpeg "$src\hero_farmer_field_1794722415281.jpg" "hero-farmer.jpg" 1500 82
Resize-Jpeg "$src\crop_maize_square_1794722415463.jpg" "crop-maize.jpg" 480 80
Resize-Jpeg "$src\crop_sorghum_square_1794722415172.jpg" "crop-sorghum.jpg" 480 80
Resize-Jpeg "$src\crop_wheat_square_1794722415692.jpg" "crop-wheat.jpg" 480 80
Resize-Jpeg "$src\crop_sunflower_square_1794722416889.jpg" "crop-sunflower.jpg" 480 80
Resize-Jpeg "$src\crop_sugarcane_square_1794722417027.jpg" "crop-sugarcane.jpg" 480 80
Resize-Jpeg "$src\earth_satellite_terrain_1794721233469.jpg" "earth-terrain.jpg" 1400 80

Get-ChildItem $dst | Select-Object Name, Length
