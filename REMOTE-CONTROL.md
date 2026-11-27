# Controle Remoto via QR + WiFi (Zelda DS)

Dois celulares na **mesma rede local**. **Celular A** roda o jogo. **Celular B** vira controlador escaneando o QR.

## Requisitos

- Mesmo WiFi nos dois celulares
- Servidor WebSocket **persistente** (não Vercel Serverless)
- Acessar o jogo pelo **IP local**, não `localhost`
- Portas: **5173** (jogo) e **3001** (WebSocket) liberadas na rede/firewall

## Início rápido (local)

```bash
cd zelda-repo
bash start-remote.sh
```

O script:
1. Detecta seu IP local
2. Inicia `bun run server` (Socket.io porta 3001)
3. Inicia `bun run dev --host 0.0.0.0` (Vite porta 5173)
4. Imprime URLs

## Passos manuais

```bash
# terminal 1 - servidor WS
bun run server                 # porta 3001

# terminal 2 - jogo
bun run dev --host 0.0.0.0     # porta 5173
```

1. Descubra seu IP local (ex: `192.168.1.5`):

```bash
hostname -I        # Linux/Termux
ip addr show       # ver inet 192.168.x.x
```

2. **Celular A:** abra `http://SEU_IP:5173` (não `localhost`).
3. **Celular B:** escaneie o QR exibido no jogo, ou abra direto:

```
http://SEU_IP:5173/controller/index.html
```

4. Controlador conecta em `http://SEU_IP:3001`. **Não use `localhost` no 2º celular.**

## O que NÃO funciona

- **`https://mitribuquezelda.vercel.app/` (Vercel Serverless):** não há WS persistente na porta 3001. QR abre a página, mas "sem conexão WS". Precisa WS externo.
- **`localhost` no 2º celular:** não alcança a máquina A. Use IP local.
- **Sem `bun run server`:** página controlador abre, mas não envia comandos.

## Produção (Vercel + WS externo)

Para funcionar em produção sem host local:

1. Deploy `server.ts` em host com WS persistente (**Railway / Fly.io / Render / PartyKit**).
2. Ajuste URLs:
   - `public/controller/index.html`: `SOCKET_URL = 'https://SEU-WS-HOST'`
   - `src/App.tsx`: socket.io.js + `io()` aponta `https://SEU-WS-HOST`
3. Ou usar **Pusher / Ably / Supabase Realtime** com chaves API.

Código pronto no repo. **Não foi possível testar com 2 celulares físicos neste ambiente.**

## O que o controlador envia

Socket.io no servidor `server.ts` faz `socket.broadcast`:

- `remote-input`: `{ key: KeyCode, down: boolean }` (X/B/A + D-Pad U/L/R/D)
- `remote-analog`: `{ x: number, y: number }` normalizado [-1, 1]

Jogo escuta `remote-input` → `engine.setKey(key, down)` e `remote-analog` → `engine.setAnalog(x, y)`.
