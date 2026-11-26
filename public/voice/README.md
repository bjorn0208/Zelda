# Vozes do jogo

Existem apenas **duas** gravações, adicionadas uma a uma:

- `father.mp3` — fala de abertura do pai, gerada no SpeechGen (share
  `25960696-73519657713394292739`, voz Davis BR). 10,8 s, 48 kHz mono.
  Fonte: `https://speechgen.io/texttomp3/20261126/p_25960696_568.mp3`.
- `story.mp3` — narração das cinco primeiras páginas da história, gerada no
  SpeechGen (share `25961153-57771565857976539919`, voz Laomedeia BR).
  27,4 s, 48 kHz mono. Fonte:
  `https://speechgen.io/texttomp3/20261126/p_25961153_718.mp3`.

As outras falas não têm voz: aparecem apenas como texto. Não há síntese de voz
do navegador (`speechSynthesis`). Para adicionar uma nova gravação, inclua uma
entrada em `VOICE_LINES` em `src/game/audio.ts` com o texto completo da fala.
