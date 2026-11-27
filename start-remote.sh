#!/usr/bin/env bash
# Zelda DS - Controle Remoto via QR + WiFi
# Dois celulares na MESMA rede local. Celular A = jogo, Celular B = controlador.
set -e

cd "$(dirname "$0")"

# Detectar IP local (não localhost!). Termux/Linux. Ajuste manual se falhar.
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "$IP" ]; then
  IP="$(ip addr show 2>/dev/null | grep -oE 'inet (192|10|172)\.[0-9.]+' | head -n1 | awk '{print $2}' | cut -d/ -f1)"
fi
if [ -z "$IP" ]; then
  IP="127.0.0.1"
  echo "AVISO: IP local não detectado. Celular B NÃO conectará com 127.0.0.1."
  echo "Descubra seu IP local (ex: 192.168.x.x) e acesse o jogo por ele."
fi

WS_PORT=3001
GAME_PORT=5173

echo "======================================"
echo "  ZELDA DS - CONTROLE REMOTO"
echo "======================================"
echo "IP local detectado : $IP"
echo "Servidor WebSocket : porta $WS_PORT"
echo "Jogo (Vite)        : http://$IP:$GAME_PORT"
echo "QR / Controlador   : http://$IP:$GAME_PORT/controller/index.html"
echo "Controlador conecta: http://$IP:$WS_PORT"
echo "======================================"
echo
echo "PASSOS:"
echo " 1. Celular B no MESMO WiFi."
echo " 2. Abra http://$IP:$GAME_PORT no Celular A."
echo " 3. Escaneie o QR no Celular B."
echo " 4. Controlador deve conectar em http://$IP:$WS_PORT"
echo "    (não localhost!)."
echo

# Garantir instalado
if [ ! -d node_modules ]; then
  echo "Instalando dependências..."
  bun install
fi

# Iniciar servidor WebSocket (persistente, não serverless)
echo "Iniciando servidor WebSocket na porta $WS_PORT..."
bun run server &
WS_PID=$!

# Iniciar jogo acessível na rede local
echo "Iniciando jogo Vite na porta $GAME_PORT..."
bun run dev --host 0.0.0.0 &
GAME_PID=$!

# Cleanup
trap "kill $WS_PID $GAME_PID 2>/dev/null || true" EXIT

# Manter rodando
wait
