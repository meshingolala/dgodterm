param(
    [string]$SourcePng = ""
)

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$proRoot = Join-Path $root "dgodterm-pro"

# Find source image
if ([string]::IsNullOrWhiteSpace($SourcePng) -or -not (Test-Path $SourcePng)) {
    $candidates = @(
        "C:\Users\meshingo\.gemini\antigravity\brain\2189937d-fb15-4d67-9908-085e88582049\concept_a_squircle.png",
        (Join-Path $root "build\icon-master.png"),
        (Join-Path $root "build\icon.png")
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $SourcePng = $cand
            break
        }
    }
}

if (-not (Test-Path $SourcePng)) {
    Write-Error "Source image not found: $SourcePng"
    exit 1
}

Write-Host "Using Source Icon: $SourcePng"

function Create-ResizedPng {
    param(
        [string]$SrcPngPath,
        [string]$DstPngPath,
        [int]$Size
    )
    $srcImg = [System.Drawing.Bitmap]::FromFile($SrcPngPath)
    $resized = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size))
    $g.Dispose()
    $srcImg.Dispose()
    
    $dstDir = [System.IO.Path]::GetDirectoryName($DstPngPath)
    if (-not [System.IO.Directory]::Exists($dstDir)) {
        [System.IO.Directory]::CreateDirectory($dstDir) | Out-Null
    }
    $resized.Save($DstPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    Write-Host "Created PNG ($Size x $Size): $DstPngPath"
}

function Create-Pristine32BitIco {
    param(
        [string]$SrcPngPath,
        [string]$DstIcoPath,
        [int[]]$Sizes = @(256, 128, 64, 48, 32, 24, 16)
    )

    $srcImg = [System.Drawing.Bitmap]::FromFile($SrcPngPath)
    $entries = [System.Collections.Generic.List[PSCustomObject]]::new()

    foreach ($sz in $Sizes) {
        $resized = New-Object System.Drawing.Bitmap $sz, $sz, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($resized)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($srcImg, (New-Object System.Drawing.Rectangle 0, 0, $sz, $sz))
        $g.Dispose()

        if ($sz -ge 256) {
            # 256x256 is stored as PNG (standard Windows Vista+ format)
            $ms = New-Object System.IO.MemoryStream
            $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $data = $ms.ToArray()
            $ms.Dispose()

            $entries.Add([PSCustomObject]@{
                Width = 0 # 0 represents 256 in ICONDIRENTRY
                Height = 0
                ColorCount = 0
                Reserved = 0
                Planes = 1
                BitCount = 32
                Data = $data
            })
        } else {
            # Sizes < 256 stored as standard uncompressed 32bpp DIB (BITMAPINFOHEADER + BGRA + 1-bit AND mask)
            # This provides 100% compatibility with GDI, Win32, WPF, and NSIS with true 32-bit ARGB colors
            $w = $sz
            $h = $sz
            $andStride = [int]([Math]::Ceiling($w / 32.0)) * 4
            $andMaskSize = $andStride * $h
            $pixelDataSize = $w * $h * 4
            $dibHeaderSize = 40
            $totalSize = $dibHeaderSize + $pixelDataSize + $andMaskSize

            $ms = New-Object System.IO.MemoryStream $totalSize
            $bw = New-Object System.IO.BinaryWriter $ms

            # BITMAPINFOHEADER
            $bw.Write([uint32]40)             # biSize
            $bw.Write([int32]$w)              # biWidth
            $bw.Write([int32]($h * 2))        # biHeight (doubled for XOR + AND mask)
            $bw.Write([uint16]1)              # biPlanes
            $bw.Write([uint16]32)             # biBitCount
            $bw.Write([uint32]0)              # biCompression (BI_RGB = 0)
            $bw.Write([uint32]($pixelDataSize + $andMaskSize)) # biSizeImage
            $bw.Write([int32]0)               # biXPelsPerMeter
            $bw.Write([int32]0)               # biYPelsPerMeter
            $bw.Write([uint32]0)              # biClrUsed
            $bw.Write([uint32]0)              # biClrImportant

            # Pixel data: bottom-to-top, BGRA format
            $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
            $bmpData = $resized.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $rowBytes = New-Object byte[] ($w * 4)
            for ($y = $h - 1; $y -ge 0; $y--) {
                $rowPtr = [IntPtr]($bmpData.Scan0.ToInt64() + ($y * $bmpData.Stride))
                [System.Runtime.InteropServices.Marshal]::Copy($rowPtr, $rowBytes, 0, $rowBytes.Length)
                $bw.Write($rowBytes)
            }
            $resized.UnlockBits($bmpData)

            # AND mask: 1 bit per pixel, 0 = transparent alpha handled by 32bpp
            $andBytes = New-Object byte[] $andMaskSize
            $bw.Write($andBytes)

            $bw.Flush()
            $data = $ms.ToArray()
            $bw.Dispose()
            $ms.Dispose()

            $entries.Add([PSCustomObject]@{
                Width = [byte]$w
                Height = [byte]$h
                ColorCount = 0
                Reserved = 0
                Planes = 1
                BitCount = 32
                Data = $data
            })
        }
        $resized.Dispose()
    }
    $srcImg.Dispose()

    # Write the complete ICO file
    $dstDir = [System.IO.Path]::GetDirectoryName($DstIcoPath)
    if ($dstDir -and -not [System.IO.Directory]::Exists($dstDir)) {
        [System.IO.Directory]::CreateDirectory($dstDir) | Out-Null
    }

    $outFs = [System.IO.File]::Create($DstIcoPath)
    $outBw = New-Object System.IO.BinaryWriter $outFs

    # ICONDIR
    $outBw.Write([uint16]0)                  # idReserved
    $outBw.Write([uint16]1)                  # idType (1 = ICO)
    $outBw.Write([uint16]$entries.Count)     # idCount

    # Calculate offset for image data
    $offset = 6 + ($entries.Count * 16)

    foreach ($e in $entries) {
        $outBw.Write([byte]$e.Width)
        $outBw.Write([byte]$e.Height)
        $outBw.Write([byte]$e.ColorCount)
        $outBw.Write([byte]$e.Reserved)
        $outBw.Write([uint16]$e.Planes)
        $outBw.Write([uint16]$e.BitCount)
        $outBw.Write([uint32]$e.Data.Length)
        $outBw.Write([uint32]$offset)
        $offset += $e.Data.Length
    }

    foreach ($e in $entries) {
        $outBw.Write($e.Data)
    }

    $outBw.Flush()
    $outBw.Dispose()
    $outFs.Dispose()

    $fileLen = (Get-Item $DstIcoPath).Length
    Write-Host "Created Pristine 32-bit ICO ($($Sizes.Length) sizes): $DstIcoPath ($fileLen bytes)"
}

# 1. Generate PNGs (1024x1024 full, 128x128 native WPF, and 64x64 web)
Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $root "build\icon.png") -Size 1024
Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $root "build\icon-master.png") -Size 1024
Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $root "dist\icon.png") -Size 1024
Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $root "src\renderer\assets\icon-64.png") -Size 64
Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $root "src-native\DgodTerm.Windows\icon.png") -Size 128
Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $root "release\native\icon.png") -Size 128

if (Test-Path $proRoot) {
    Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $proRoot "build\icon.png") -Size 1024
    Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $proRoot "build\icon-master.png") -Size 1024
    Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $proRoot "dist\icon.png") -Size 1024
    Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $proRoot "src\renderer\assets\icon-64.png") -Size 64
    Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $proRoot "src-native\DgodTerm.Windows\icon.png") -Size 128
    Create-ResizedPng -SrcPngPath $SourcePng -DstPngPath (Join-Path $proRoot "release\native\icon.png") -Size 128
}

# 2. Generate Pristine 32-bit Multi-Resolution ICOs
Create-Pristine32BitIco -SrcPngPath $SourcePng -DstIcoPath (Join-Path $root "src-native\DgodTerm.Windows\icon.ico")
Create-Pristine32BitIco -SrcPngPath $SourcePng -DstIcoPath (Join-Path $root "release\native\icon.ico")
if (Test-Path (Join-Path $root "release\.icon-ico")) {
    Create-Pristine32BitIco -SrcPngPath $SourcePng -DstIcoPath (Join-Path $root "release\.icon-ico\icon.ico")
}

if (Test-Path $proRoot) {
    Create-Pristine32BitIco -SrcPngPath $SourcePng -DstIcoPath (Join-Path $proRoot "src-native\DgodTerm.Windows\icon.ico")
    Create-Pristine32BitIco -SrcPngPath $SourcePng -DstIcoPath (Join-Path $proRoot "release\native\icon.ico")
}

Write-Host "All pristine high-DPI icons generated and deployed successfully."
