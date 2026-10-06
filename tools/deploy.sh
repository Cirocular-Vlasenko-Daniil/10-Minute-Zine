#!/bin/bash
# Выкладка сайта на 10minutezine.com (хост «zine» из ~/.ssh/config).
#
#   tools/deploy.sh             — собрать архив (tools/package.py), залить и выложить
#   tools/deploy.sh --rollback  — вернуть предыдущую версию
#
# Саму выкладку делает серверный скрипт Ильи ~/deploy.sh (запускается через sudo):
# релиз в /var/www/10minutezine/releases/<время>, атомарное переключение current,
# конфиг nginx, сертификат, проверки ответов; хранит 5 версий.
set -euo pipefail

HOST=zine
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# на 10minutezine.com — только ветка main (бета живёт в своей ветке и на сайт не уходит)
BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
if [ "$BRANCH" != "main" ] && [ "${1:-}" != "--rollback" ]; then
  echo "Сейчас ветка «$BRANCH» — на сайт выкладывается только main."
  echo "Переключитесь: git -C \"$ROOT\" checkout main"
  exit 1
fi

if [ "${1:-}" = "--rollback" ]; then
  ssh "$HOST" 'sudo bash ~/deploy.sh --rollback'
  exit 0
fi

python3 "$ROOT/tools/package.py"
echo "версия $(grep -o 'main.js?v=[0-9a-f]*' "$ROOT/dist/10minutezine/editor.html" | cut -d= -f2)"
scp -q "$ROOT/dist/10minutezine.zip" "$HOST:~/10minutezine.zip"
ssh "$HOST" 'sudo bash ~/deploy.sh ~/10minutezine.zip'
