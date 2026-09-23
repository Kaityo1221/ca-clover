import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const SAMPLE_RATE = 22050;

function wavResponse(samples: Float32Array) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(44 + index * 2, Math.round(value * 32767), true);
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function pseudoNoise(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff * 2 - 1;
  };
}

function makeFootstep() {
  const duration = 1.7;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const noise = pseudoNoise(17);
  let phase = 0;
  let smooth = 0;

  for (let index = 0; index < length; index += 1) {
    const t = index / SAMPLE_RATE;
    const frequency = 24 + 64 * Math.exp(-t * 3.2);
    phase += Math.PI * 2 * frequency / SAMPLE_RATE;
    smooth = smooth * 0.97 + noise() * 0.03;
    const attack = Math.min(1, t / 0.012);
    const body = Math.sin(phase) * 0.82 + smooth * 1.45;
    let value = body * attack * Math.exp(-t * 1.7);

    if (t > 0.34) {
      const local = t - 0.34;
      value += Math.sin(phase * 0.72) * 0.22 * Math.exp(-local * 3.1);
    }
    samples[index] = value * 0.72;
  }

  return samples;
}

function makeRoar() {
  const duration = 2.9;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const noise = pseudoNoise(73);
  let phase = 0;
  let low = 0;

  for (let index = 0; index < length; index += 1) {
    const t = index / SAMPLE_RATE;
    const frequency = 105 + 38 * Math.sin(Math.PI * 2 * 1.6 * t) + 75 * Math.exp(-t * 1.5);
    phase += Math.PI * 2 * frequency / SAMPLE_RATE;
    low = low * 0.94 + noise() * 0.06;
    const envelope = Math.min(1, t / 0.12) * Math.exp(-t * 0.55) * (1 - 0.18 * Math.sin(Math.PI * 2 * 4 * t));
    const tone = Math.sin(phase) + 0.35 * Math.sin(phase * 0.52) + 0.22 * Math.sin(phase * 1.9);
    samples[index] = (tone * 0.33 + low * 0.74) * envelope;
  }

  return samples;
}

function makeFire() {
  const duration = 3.6;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const noise = pseudoNoise(113);
  let previous = 0;
  let smooth = 0;

  for (let index = 0; index < length; index += 1) {
    const t = index / SAMPLE_RATE;
    const raw = noise();
    const high = raw - previous;
    previous = raw;
    smooth = smooth * 0.965 + raw * 0.035;
    const fadeIn = Math.min(1, t / 0.18);
    const fadeOut = Math.min(1, Math.max(0, duration - t) / 0.6);
    const flutter = 0.75 + 0.25 * Math.sin(Math.PI * 2 * 7.2 * t + 0.4 * Math.sin(Math.PI * 2 * 0.9 * t));
    let value = (high * 0.11 + smooth * 0.95) * fadeIn * fadeOut * flutter;

    const crackle = Math.abs(noise()) > 0.985 ? noise() * 0.28 : 0;
    value += crackle;
    samples[index] = value;
  }

  return samples;
}

function emblemSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe98a"/>
      <stop offset=".34" stop-color="#d8a03b"/>
      <stop offset=".72" stop-color="#8b4f15"/>
      <stop offset="1" stop-color="#4d2509"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="#d92b18" stop-opacity=".42"/>
      <stop offset="1" stop-color="#4d0502" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="ember"><feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#d22a12" flood-opacity=".7"/></filter>
  </defs>
  <circle cx="512" cy="512" r="350" fill="url(#glow)" filter="url(#soft)"/>
  <path d="M512 90 805 188 770 535 695 720 512 895 329 720 254 535 219 188Z" fill="url(#gold)" stroke="#f7d36a" stroke-width="18"/>
  <path d="M512 118 777 207 744 523 676 698 512 858 348 698 280 523 247 207Z" fill="none" stroke="#6c350d" stroke-width="10"/>
  <g filter="url(#ember)" fill="#321006" stroke="#8a4713" stroke-width="8" stroke-linejoin="round">
    <path d="M592 219c-43-30-106-7-126 37 39-15 72-3 85 20-69-5-121 35-128 91 27-27 62-38 96-28-48 22-78 71-65 122 23-40 58-62 101-64-25 30-32 70-16 111 12-48 44-80 89-93 29-8 52-25 68-48-33 8-61 3-82-16 43-13 72-40 87-83-33 18-67 20-99 5 22-16 32-36 30-59-14 11-26 19-40 25Z"/>
    <path d="M472 379 321 302 411 452 304 480 469 543Z"/>
    <path d="M577 396 741 331 646 477 760 518 572 552Z"/>
    <path d="M520 596 449 699 392 741" fill="none" stroke-width="35" stroke-linecap="round"/>
    <path d="M560 623 631 704 684 735" fill="none" stroke-width="31" stroke-linecap="round"/>
    <path d="M595 236 624 157 643 229 682 177 660 247Z"/>
    <path d="M624 251 704 269 655 302 610 282Z"/>
  </g>
  <circle cx="643" cy="248" r="12" fill="#ff4b24"/>
  <circle cx="647" cy="245" r="4" fill="#ffe66b"/>
  <path d="M286 204 431 139 719 225 426 574Z" fill="#fffbdc" opacity=".07"/>
</svg>`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  const decoded = decodeURIComponent(asset);

  if (decoded === "金色竜の紋章盾.png") {
    return new Response(emblemSvg(), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (decoded === "怪獣の足音.mp3") return wavResponse(makeFootstep());
  if (decoded === "dragon-studio-epic-dragon-roar-364481.mp3") return wavResponse(makeRoar());
  if (decoded === "ドラゴンが火を吐く.mp3") return wavResponse(makeFire());

  return new Response("Not found", { status: 404 });
}
