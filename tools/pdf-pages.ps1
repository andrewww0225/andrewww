param(
  [Parameter(Mandatory)][string]$Pdf,
  [Parameter(Mandatory)][string]$OutDir,
  [Parameter(Mandatory)][string]$Pages, # "3,14,15" (-File passes one string)
  [int]$Width = 1280,
  [int]$Quality = 80
)
# Render selected PDF pages to JPG (p<N>.jpg) with the Windows built-in PDF renderer; nothing to install.
# Run with Windows PowerShell 5.1: powershell -NoProfile -ExecutionPolicy Bypass -File tools\pdf-pages.ps1 -Pdf x.pdf -OutDir quiz\slides\finance-ch1 -Pages 3,14
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$ext = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
$asOp = $ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asAction = $ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
function AwaitOp($op, [type]$t) { $task = $asOp.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
function AwaitAction($op) { $asAction.Invoke($null, @($op)).Wait() }

$file = AwaitOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc = AwaitOp ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
New-Item -ItemType Directory -Force $OutDir | Out-Null
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$enc = New-Object System.Drawing.Imaging.EncoderParameters 1
$enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Quality)

foreach ($n in ($Pages -split '[,\s]+' | Where-Object { $_ } | ForEach-Object { [int]$_ })) {
  if ($n -lt 1 -or $n -gt $doc.PageCount) { "skip p$n (PDF has $($doc.PageCount) pages)"; continue }
  $page = $doc.GetPage($n - 1)
  $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opts.DestinationWidth = $Width
  $ms = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  AwaitAction ($page.RenderToStreamAsync($ms, $opts))
  $raw = [System.Drawing.Image]::FromStream([System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ms.GetInputStreamAt(0)))
  # DestinationWidth is not always honoured, so scale down here as well
  $h = [int]($raw.Height * $Width / $raw.Width)
  $img = New-Object System.Drawing.Bitmap $Width, $h
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::White); $g.DrawImage($raw, 0, 0, $Width, $h); $g.Dispose(); $raw.Dispose()
  $out = Join-Path (Resolve-Path $OutDir).Path "p$n.jpg"
  $img.Save($out, $jpeg, $enc)
  "p$n.jpg {0}x{1} {2} KB" -f $img.Width, $img.Height, [math]::Round((Get-Item $out).Length / 1KB)
  $img.Dispose(); $page.Dispose()
}
