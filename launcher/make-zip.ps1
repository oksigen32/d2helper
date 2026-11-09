# Собирает dist\D2Helper.zip для друзей: exe + адрес приложения + инструкция (без личных данных)
$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $app 'dist\D2Helper'
Remove-Item (Join-Path $app 'dist') -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $app 'D2Helper.exe'), (Join-Path $app 'app-url.txt') $stage
$readme = @"
D2Helper - дневник игрока Dota 2

1. Распакуй эту папку куда удобно (например, в Документы).
2. Запусти D2Helper.exe.
   Если Windows покажет "Система Windows защитила ваш компьютер" -
   нажми "Подробнее" -> "Выполнить в любом случае" (один раз).
3. Чтобы сделать ярлык: правой кнопкой по D2Helper.exe -> "Показать дополнительные параметры" -> "Создать ярлык".

Обновления приходят автоматически. Все записи хранятся только на твоём компьютере
(в папке data рядом с exe). Резервная копия: Настройки -> Экспорт в JSON.
Онлайн-версия: https://oksigen32.github.io/d2helper/
"@
[IO.File]::WriteAllText((Join-Path $stage 'Прочитай меня.txt'), $readme, (New-Object Text.UTF8Encoding $true))
Compress-Archive -Path $stage -DestinationPath (Join-Path $app 'dist\D2Helper.zip') -Force
Write-Host "OK: dist\D2Helper.zip"
