# Vozes dos personagens

- `father.mp3` — fala de abertura do pai, gerada no SpeechGen (share
  `25960696-73519657713394292739`, voz Davis BR). 10,8 s, 48 kHz mono.
  Fonte: `https://speechgen.io/texttomp3/20261126/p_25960696_568.mp3`.

As demais falas usam a síntese de voz do navegador (`speechSynthesis`, pt-BR),
com timbre/rate/pitch diferentes por tipo de personagem e pequena variação
pelo nome. Para trocar qualquer fala por uma gravação própria, basta adicionar
uma entrada em `VOICE_LINES` em `src/game/audio.ts`.
