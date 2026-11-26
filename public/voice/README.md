# Vozes do jogo

Todas as falas com áudio vêm do SpeechGen e ficam em `VOICE_LINES` em
`src/game/audio.ts`. O texto completo de cada fala é comparado antes da
paginação, então a gravação toca uma vez mesmo quando o diálogo ocupa várias
páginas. Todas as falas — inclusive as gravadas — exibem legenda branca em
fonte medieval, sem caixa ou faixa de fundo. Não há síntese de voz do navegador
(`speechSynthesis`).

| Arquivo | Fala | Share SpeechGen | Duração |
| --- | --- | --- | --- |
| `father.mp3` | Fala de abertura do pai | `25960696-73519657713394292739` | 10,8 s |
| `story.mp3` | Narração das cinco primeiras páginas da história | `25961153-57771565857976539919` | 27,4 s |
| `sword_hint.mp3` | Dica da Espada Lendária (ancião) | `25970815-35366554272342999166` | 7,4 s |
| `sword_pulled.mp3` | Retirada da Espada Lendária | `25970925-65217794182329725257` | 7,8 s |
| `awakening_line.mp3` | Despertar em casa | `25971016-86528394343912262928` | 8,9 s |
| `theo_line.mp3` | Mercador Theo, ao abrir a loja de itens | `25971172-18193281236764162354` | 6,0 s |
| `blacksmith_line.mp3` | Mestre Ferreiro, ao abrir a forja | `25971313-13674451594234622831` | 3,0 s |
| `tailor_line.mp3` | Costureira Clara, ao abrir a alfaiataria | `25971381-55128331781214282691` | 4,8 s |
| `bazaar_line.mp3` | Mercador Breno / Mercador da Vila, ao abrir o bazar | `25971468-84141777222596648878` | 3,9 s |
| `guard_line.mp3` | Guarda Marcos, sobre a Vila Central | `25971654-48999644567233282135` | 7,6 s |

Para adicionar uma nova gravação, coloque o MP3 aqui, inclua a constante do
texto em `src/game/constants.ts` e uma entrada em `VOICE_LINES`.
