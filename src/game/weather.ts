import { H, W } from './constants';
import { LightningBolt, RainDrop, WeatherState } from './types';

function makeDrop(layer: 0 | 1 | 2, randomY = true): RainDrop {
  const speedScale = layer === 0 ? 1.0 : layer === 1 ? 1.35 : 1.75;
  return {
    x: Math.random() * (W + 60) - 20,
    y: randomY ? Math.random() * H : -6 - Math.random() * 24,
    vx: -1.35 * speedScale,
    vy: 3.4 * speedScale,
    len: layer === 0 ? 4 : layer === 1 ? 6 : 9,
    layer,
  };
}

function createBolt(): LightningBolt {
  const segments: Array<[number, number, number, number]> = [];
  let x = 28 + Math.random() * (W - 56);
  let y = 8;
  const targetY = 58 + Math.random() * 28;

  while (y < targetY) {
    const nx = x + (Math.random() - 0.5) * 16;
    const ny = Math.min(targetY, y + 7 + Math.random() * 9);
    segments.push([x, y, nx, ny]);
    // Occasional fork branch
    if (Math.random() < 0.35 && segments.length > 1) {
      const bx = nx + (Math.random() - 0.5) * 18;
      const by = ny + 6 + Math.random() * 8;
      segments.push([nx, ny, bx, by]);
    }
    x = nx;
    y = ny;
  }

  return { segments, life: 12 };
}

export function createWeatherState(): WeatherState {
  const drops: RainDrop[] = [];
  for (let i = 0; i < 110; i++) {
    const layer = (i % 3) as 0 | 1 | 2;
    drops.push(makeDrop(layer, true));
  }
  return {
    drops,
    splashes: [],
    flash: 0,
    nextLightning: 55,
    thunderDelay: -1,
    thunderIntensity: 1,
    bolt: null,
    clearBanner: 0,
  };
}

export function triggerLightningNow(w: WeatherState, thunderDelay = 10, intensity = 1.1): void {
  w.flash = 16;
  w.bolt = createBolt();
  w.thunderDelay = thunderDelay;
  w.thunderIntensity = intensity;
}

export function stepWeather(
  w: WeatherState,
  mode: 'story' | 'overworld' | 'none',
  onThunder: (intensity: number) => void,
): void {
  if (w.clearBanner > 0) w.clearBanner--;

  if (mode === 'none') {
    w.flash = Math.max(0, w.flash - 2);
    w.bolt = null;
    w.thunderDelay = -1;
    return;
  }

  const activeCount = mode === 'story' ? 110 : 84;
  for (let i = 0; i < activeCount; i++) {
    const d = w.drops[i];
    d.x += d.vx;
    d.y += d.vy;

    const floorY = mode === 'story' ? 128 + (i % 24) : H - 4 - (i % 20);
    if (d.y > floorY && d.layer >= 1 && Math.random() < 0.25 && w.splashes.length < 36) {
      w.splashes.push({ x: d.x, y: floorY, life: 6 });
    }

    if (d.y > H + 8 || d.x < -30) {
      const reset = makeDrop(d.layer, false);
      d.x = Math.random() * (W + 70);
      d.y = reset.y;
    }
  }

  for (let i = w.splashes.length - 1; i >= 0; i--) {
    w.splashes[i].life--;
    if (w.splashes[i].life <= 0) w.splashes.splice(i, 1);
  }

  if (w.flash > 0) w.flash--;
  if (w.bolt) {
    w.bolt.life--;
    if (w.bolt.life <= 0) w.bolt = null;
  }

  if (w.thunderDelay > 0) {
    w.thunderDelay--;
    if (w.thunderDelay === 0) {
      onThunder(w.thunderIntensity);
      w.thunderDelay = -1;
    }
  }

  w.nextLightning--;
  if (w.nextLightning <= 0) {
    const isStory = mode === 'story';
    triggerLightningNow(w, isStory ? 6 + Math.floor(Math.random() * 12) : 10 + Math.floor(Math.random() * 18), isStory ? 1.15 : 0.85);
    w.nextLightning = isStory ? 95 + Math.floor(Math.random() * 110) : 190 + Math.floor(Math.random() * 180);
  }
}
