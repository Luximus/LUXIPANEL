$port = 4321
$ids = @()

$ids += Get-NetTCPConnection -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq $port } |
  Select-Object -ExpandProperty OwningProcess -Unique

$ids += Get-NetUDPEndpoint -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq $port } |
  Select-Object -ExpandProperty OwningProcess -Unique

$ids = $ids | Where-Object { $_ } | Sort-Object -Unique

foreach ($id in $ids) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}
