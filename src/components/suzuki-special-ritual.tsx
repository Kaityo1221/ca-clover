"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StampMedal3D } from "@/components/stamp-medal-3d";

type SuzukiPhase =
  | "idle"
  | "heartbeat_intro"
  | "text_reveal"
  | "tap_wait"
  | "roar"
  | "badge_normal"
  | "fire"
  | "burned";

type DragonVisual = {
  scale: number;
  brightness: number;
  opacity: number;
  glow: number;
};

const SUZUKI_NAME = "suzukipm";
const DRAGON_EMBLEM_SRC = "/suzuki-special/金色竜の紋章盾.png";
const FOOTSTEP_SRC = "/suzuki-special/怪獣の足音.mp3";
const ROAR_SRC = "/suzuki-special/dragon-studio-epic-dragon-roar-364481.mp3";
const FIRE_SRC = "/suzuki-special/ドラゴンが火を吐く.mp3";

const NORMAL_ENGRAVING = ["SuzukiPM\u200B", "1st", "Chiba, Japan", "2026.09.22"] as const;
const BURNED_ENGRAVING = ["SuzukiPM", "1st", "Chiba, Japan", "2026.09.22"] as const;

function isTemporarySuzukiSpecialText(value: string | null | undefined) {
  return value?.trim().toLowerCase() === SUZUKI_NAME;
}

function isTemporarySuzukiSpecialButton(button: HTMLButtonElement) {
  const raw = button.textContent ?? "";
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text.toLowerCase().includes(SUZUKI_NAME)) return false;

  // CA selector buttons render `1st ・ SuzukiPM` / `2nd ・ SuzukiPM`.
  if (/・\s*SuzukiPM/i.test(text)) return true;

  // Community cards are safe to intercept only when SuzukiPM is the sole CA shown.
  // Multi-CA communities first open normally; selecting SuzukiPM inside the modal then starts the ritual.
  const caMarkers = raw.match(/[●○]/g)?.length ?? 0;
  return caMarkers === 1 && /[●○]\s*SuzukiPM/i.test(raw);
}

function makeImpulseResponse(context: AudioContext, seconds = 1.3, decay = 2.8) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const envelope = Math.pow(1 - index / length, decay);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
  }
  return impulse;
}

export function SuzukiSpecialRitual() {
  const [phase, setPhase] = useState<SuzukiPhase>("idle");
  const [tapCount, setTapCount] = useState(0);
  const [dragon, setDragon] = useState<DragonVisual>({
    scale: 0.84,
    brightness: 0.55,
    opacity: 0,
    glow: 0.08,
  });
  const [textStage, setTextStage] = useState<0 | 1 | 2>(0);
  const [textFading, setTextFading] = useState(false);
  const [shakeLevel, setShakeLevel] = useState<0 | 1 | 2 | 3>(0);
  const [flash, setFlash] = useState<"none" | "red" | "darkred" | "white">("none");
  const [emblemAvailable, setEmblemAvailable] = useState(true);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [fireCooling, setFireCooling] = useState(false);
  const [finishOverlay, setFinishOverlay] = useState(false);

  const phaseRef = useRef<SuzukiPhase>("idle");
  const targetButtonRef = useRef<HTMLButtonElement | null>(null);
  const bypassNextSuzukiClickRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const currentScaleRef = useRef(0.84);
  const audioContextRef = useRef<AudioContext | null>(null);
  const footstepBufferRef = useRef<AudioBuffer | null>(null);
  const footstepLoadingRef = useRef<Promise<AudioBuffer | null> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((timer) => timer !== id);
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const context = new AudioContextCtor();
    audioContextRef.current = context;
    void context.resume().catch(() => {});
    return context;
  }, []);

  const playHeartbeatPulse = useCallback(() => {
    const context = ensureAudioContext();
    if (!context) return;
    const now = context.currentTime;

    const playThump = (offset: number, gainValue: number, frequency: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(38, now + offset + 0.16);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.19);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.22);
    };

    playThump(0, 0.22, 72);
    playThump(0.11, 0.12, 58);
  }, [ensureAudioContext]);

  const synthFootstepFallback = useCallback((volume: number, near: boolean) => {
    const context = ensureAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(near ? 72 : 52, now);
    oscillator.frequency.exponentialRampToValueAtTime(27, now + 0.42);
    filter.type = "lowpass";
    filter.frequency.value = near ? 1200 : 520;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.02, volume * 0.42), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    oscillator.connect(filter).connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.58);
  }, [ensureAudioContext]);

  const loadFootstepBuffer = useCallback(async () => {
    if (footstepBufferRef.current) return footstepBufferRef.current;
    if (footstepLoadingRef.current) return footstepLoadingRef.current;
    const context = ensureAudioContext();
    if (!context) return null;

    footstepLoadingRef.current = fetch(FOOTSTEP_SRC)
      .then((response) => {
        if (!response.ok) throw new Error("footstep asset unavailable");
        return response.arrayBuffer();
      })
      .then((buffer) => context.decodeAudioData(buffer.slice(0)))
      .then((decoded) => {
        footstepBufferRef.current = decoded;
        return decoded;
      })
      .catch(() => null)
      .finally(() => {
        footstepLoadingRef.current = null;
      });

    return footstepLoadingRef.current;
  }, [ensureAudioContext]);

  const playProcessedFootstep = useCallback(async ({
    volume,
    lowPass,
    bassGain,
    reverbMix,
    near,
  }: {
    volume: number;
    lowPass: number;
    bassGain: number;
    reverbMix: number;
    near: boolean;
  }) => {
    const context = ensureAudioContext();
    if (!context) return;
    void context.resume().catch(() => {});
    const buffer = await loadFootstepBuffer();
    if (!buffer) {
      synthFootstepFallback(volume, near);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const lowPassFilter = context.createBiquadFilter();
    lowPassFilter.type = "lowpass";
    lowPassFilter.frequency.value = lowPass;
    lowPassFilter.Q.value = 0.7;

    const bass = context.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 160;
    bass.gain.value = bassGain;

    const dryGain = context.createGain();
    dryGain.gain.value = volume * (1 - reverbMix * 0.4);

    const convolver = context.createConvolver();
    convolver.buffer = makeImpulseResponse(context, near ? 0.8 : 1.6, near ? 3.5 : 2.1);
    const wetGain = context.createGain();
    wetGain.gain.value = Math.max(0, reverbMix) * volume;

    source.connect(lowPassFilter).connect(bass);
    bass.connect(dryGain).connect(context.destination);
    bass.connect(convolver).connect(wetGain).connect(context.destination);
    source.start();
  }, [ensureAudioContext, loadFootstepBuffer, synthFootstepFallback]);

  const synthRoarFallback = useCallback(() => {
    const context = ensureAudioContext();
    if (!context) return;
    const duration = 1.2;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / data.length;
      const envelope = Math.sin(Math.PI * Math.min(1, t * 1.5)) * Math.pow(1 - t, 0.42);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 145;
    filter.Q.value = 0.6;
    const gain = context.createGain();
    gain.gain.value = 0.62;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }, [ensureAudioContext]);

  const synthFireFallback = useCallback(() => {
    const context = ensureAudioContext();
    if (!context) return;
    const duration = 3.1;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / data.length;
      const envelope = Math.min(1, t * 8) * Math.pow(1 - t, 0.26);
      const flutter = 0.55 + 0.45 * Math.sin(i * 0.011) * Math.sin(i * 0.0023);
      data[i] = (Math.random() * 2 - 1) * envelope * flutter;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2100;
    const gain = context.createGain();
    gain.gain.value = 0.34;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }, [ensureAudioContext]);

  const playSimpleAudio = useCallback((src: string, volume: number, fallback: () => void) => {
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.preload = "auto";
      let fellBack = false;
      const useFallback = () => {
        if (fellBack) return;
        fellBack = true;
        fallback();
      };
      audio.addEventListener("error", useFallback, { once: true });
      void audio.play().catch(useFallback);
    } catch {
      fallback();
    }
  }, []);

  const resetSequence = useCallback(() => {
    clearTimers();
    setTapCount(0);
    setDragon({ scale: 0.84, brightness: 0.55, opacity: 0, glow: 0.08 });
    currentScaleRef.current = 0.84;
    setTextStage(0);
    setTextFading(false);
    setShakeLevel(0);
    setFlash("none");
    setFireCooling(false);
    setFinishOverlay(false);
    targetButtonRef.current = null;
    setCapturedImageUrl(null);
    setPhase("idle");
  }, [clearTimers]);

  const openOriginalSuzukiBadge = useCallback(() => {
    const button = targetButtonRef.current;
    if (!button || !document.contains(button)) return;
    bypassNextSuzukiClickRef.current = true;
    button.click();
  }, []);

  const startFireSequence = useCallback(() => {
    setPhase("fire");
    setFireCooling(false);
    playSimpleAudio(FIRE_SRC, 1, synthFireFallback);

    schedule(() => setFlash("red"), 720);
    schedule(() => setFlash("white"), 1120);
    schedule(() => setFlash("none"), 1260);
    schedule(() => setFireCooling(true), 2350);
    schedule(() => {
      setFlash("white");
      setPhase("burned");
    }, 2700);
    schedule(() => setFlash("none"), 2860);
    schedule(() => setFinishOverlay(true), 3300);
    schedule(() => {
      // Keep the real badge modal underneath as the durable final state.
      setFinishOverlay(false);
    }, 4200);
  }, [playSimpleAudio, schedule, synthFireFallback]);

  const openSuzukiBadgeNormal = useCallback(() => {
    openOriginalSuzukiBadge();
    setPhase("badge_normal");
    schedule(startFireSequence, 2000);
  }, [openOriginalSuzukiBadge, schedule, startFireSequence]);

  const startDragonRoarTransition = useCallback(() => {
    setPhase("roar");
    setShakeLevel(3);
    playSimpleAudio(ROAR_SRC, 1, synthRoarFallback);

    setDragon((current) => ({
      ...current,
      opacity: 1,
      brightness: 1.75,
      glow: 0.95,
      scale: current.scale * 1.08,
    }));
    setFlash("red");

    schedule(() => setFlash("darkred"), 450);
    schedule(() => setFlash("none"), 700);
    schedule(() => setShakeLevel(0), 900);
    schedule(() => {
      setFlash("white");
    }, 950);
    schedule(() => {
      setFlash("none");
      openSuzukiBadgeNormal();
    }, 1250);
  }, [openSuzukiBadgeNormal, playSimpleAudio, schedule, synthRoarFallback]);

  const handleRitualTap = useCallback(() => {
    if (phaseRef.current !== "tap_wait") return;
    const next = Math.min(3, tapCount + 1);
    setTapCount(next);

    if (next === 1) {
      void playProcessedFootstep({
        volume: 0.72,
        lowPass: 900,
        bassGain: 3,
        reverbMix: 0.45,
        near: false,
      });
      setShakeLevel(1);
      setDragon((current) => ({
        ...current,
        scale: current.scale * 1.008,
        brightness: 1.05,
      }));
      schedule(() => setShakeLevel(0), 450);
      return;
    }

    if (next === 2) {
      void playProcessedFootstep({
        volume: 0.98,
        lowPass: 2600,
        bassGain: 5,
        reverbMix: 0.15,
        near: true,
      });
      setShakeLevel(2);
      setDragon((current) => ({
        ...current,
        scale: current.scale * 1.025,
        brightness: 1.18,
        glow: 0.4,
      }));
      schedule(() => setShakeLevel(0), 550);
      return;
    }

    startDragonRoarTransition();
  }, [playProcessedFootstep, schedule, startDragonRoarTransition, tapCount]);

  const startSuzukiSequence = useCallback(() => {
    clearTimers();
    setTapCount(0);
    setTextStage(0);
    setTextFading(false);
    setShakeLevel(0);
    setFlash("none");
    setFireCooling(false);
    setFinishOverlay(false);
    currentScaleRef.current = 0.84;
    setDragon({ scale: 0.84, brightness: 0.55, opacity: 0, glow: 0.08 });
    setPhase("heartbeat_intro");

    schedule(() => {
      setDragon((current) => ({ ...current, opacity: 0.16 }));
    }, 160);

    const beatOffsets = [300, 1080, 1870, 2680, 3510];
    beatOffsets.forEach((offset, index) => {
      schedule(() => {
        const strength = 0.9 + index * 0.08;
        currentScaleRef.current += 0.012;
        playHeartbeatPulse();
        setDragon({
          scale: currentScaleRef.current + 0.018 * strength,
          brightness: 1 + 0.25 * strength,
          opacity: Math.min(0.78, 0.26 + index * 0.12),
          glow: Math.min(0.72, 0.2 + 0.35 * strength),
        });

        schedule(() => {
          setDragon({
            scale: currentScaleRef.current - 0.006,
            brightness: 0.9,
            opacity: Math.min(0.72, 0.24 + index * 0.11),
            glow: 0.18 + index * 0.045,
          });
        }, 110);
      }, offset);
    });

    schedule(() => {
      setDragon((current) => ({
        ...current,
        scale: currentScaleRef.current,
        brightness: 0.55,
        opacity: 0.7,
        glow: 0.12,
      }));
    }, 4050);

    schedule(() => {
      setPhase("text_reveal");
      setTextStage(1);
    }, 4550);
    schedule(() => setTextStage(2), 5950);
    schedule(() => setTextFading(true), 8150);
    schedule(() => {
      setTextStage(0);
      setTextFading(false);
      setPhase("tap_wait");
    }, 9050);
  }, [clearTimers, playHeartbeatPulse, schedule]);

  useEffect(() => {
    mountedRef.current = true;

    const onCaptureClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-suzuki-ritual-root='true']")) return;

      if (bypassNextSuzukiClickRef.current) {
        bypassNextSuzukiClickRef.current = false;
        return;
      }

      if (phaseRef.current !== "idle") return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (!isTemporarySuzukiSpecialButton(button)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      targetButtonRef.current = button;
      const directImage = button.querySelector("img") as HTMLImageElement | null;
      const modalImage = document.querySelector(".fixed.inset-0.z-50 img") as HTMLImageElement | null;
      setCapturedImageUrl(directImage?.currentSrc || directImage?.src || modalImage?.currentSrc || modalImage?.src || null);
      void ensureAudioContext()?.resume().catch(() => {});
      void loadFootstepBuffer();
      startSuzukiSequence();
    };

    window.addEventListener("click", onCaptureClick, true);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("click", onCaptureClick, true);
      clearTimers();
      const context = audioContextRef.current;
      if (context) void context.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, [clearTimers, ensureAudioContext, loadFootstepBuffer, startSuzukiSequence]);

  useEffect(() => {
    if (phase !== "burned") return;

    const observer = new MutationObserver(() => {
      const modalClose = document.querySelector('button[aria-label="閉じる"]');
      if (!modalClose) resetSequence();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const safety = window.setTimeout(() => {
      // If the real modal remains open, release interception state after the visual has settled.
      if (document.querySelector('button[aria-label="閉じる"]')) {
        setPhase("idle");
        setTapCount(0);
      }
    }, 7000);

    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, [phase, resetSequence]);

  const showRitualOverlay = ["heartbeat_intro", "text_reveal", "tap_wait", "roar"].includes(phase);
  const showBadgeOverlay = ["badge_normal", "fire", "burned"].includes(phase);
  const isTemporarySuzukiSpecial = isTemporarySuzukiSpecialText("SuzukiPM");
  const showSuzukiBurn = isTemporarySuzukiSpecial && phase === "burned";

  if (phase === "idle") return null;

  const shakeClass =
    shakeLevel === 3 ? "suzuki-shake-3" : shakeLevel === 2 ? "suzuki-shake-2" : shakeLevel === 1 ? "suzuki-shake-1" : "";

  return (
    <div data-suzuki-ritual-root="true" className="fixed inset-0 z-[400]">
      <style>{`
        @keyframes suzukiShake1{0%,100%{transform:translate(0)}25%{transform:translate(1.5px,2px)}50%{transform:translate(-1px,-1.5px)}75%{transform:translate(1px,-1px)}}
        @keyframes suzukiShake2{0%,100%{transform:translate(0)}18%{transform:translate(4px,6px)}36%{transform:translate(-4px,-4px)}55%{transform:translate(3px,-5px)}74%{transform:translate(-3px,3px)}}
        @keyframes suzukiShake3{0%,100%{transform:translate(0)}12%{transform:translate(8px,10px)}24%{transform:translate(-8px,-7px)}36%{transform:translate(7px,-9px)}48%{transform:translate(-6px,8px)}60%{transform:translate(5px,-5px)}72%{transform:translate(-4px,5px)}}
        .suzuki-shake-1{animation:suzukiShake1 .45s ease-out both}
        .suzuki-shake-2{animation:suzukiShake2 .55s ease-out both}
        .suzuki-shake-3{animation:suzukiShake3 .9s ease-out both}
        @keyframes suzukiTextIn{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
        @keyframes suzukiFireFront{0%{transform:translateY(105%) scaleX(.8);opacity:0}16%{opacity:.88}45%{transform:translateY(12%) scaleX(1.08);opacity:1}78%{opacity:.72}100%{transform:translateY(-22%) scaleX(.9);opacity:0}}
        @keyframes suzukiFireBack{0%{transform:translateY(95%) scale(.9);opacity:0}25%{opacity:.72}60%{transform:translateY(8%) scale(1.15);opacity:.82}100%{transform:translateY(-30%) scale(.96);opacity:0}}
        @keyframes suzukiSpark{0%{transform:translate3d(0,0,0) scale(.55);opacity:0}18%{opacity:1}100%{transform:translate3d(var(--spark-x),var(--spark-y),0) scale(.05);opacity:0}}
        @keyframes suzukiSmoke{0%{transform:translateY(16px) scale(.75);opacity:0}25%{opacity:.34}100%{transform:translateY(-95px) scale(1.45);opacity:0}}
        @keyframes suzukiHeatWave{0%,100%{transform:translateX(-3px) skewX(-1deg);opacity:.1}50%{transform:translateX(4px) skewX(1.4deg);opacity:.28}}
        @keyframes suzukiFinishFade{from{opacity:1}to{opacity:0}}
      `}</style>

      {showRitualOverlay ? (
        <button
          type="button"
          aria-label="SuzukiPM special ritual"
          onClick={handleRitualTap}
          className={`absolute inset-0 h-full w-full overflow-hidden bg-black text-left ${shakeClass}`}
          style={{ cursor: phase === "tap_wait" ? "pointer" : "default" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(92,8,6,.28),transparent_46%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,.45)_58%,rgba(0,0,0,.94)_100%)]" />

          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="relative flex w-full max-w-md flex-col items-center text-center">
              <div
                className="relative grid size-[280px] place-items-center transition-[transform,filter,opacity] duration-300 ease-out sm:size-[330px]"
                style={{
                  transform: `scale(${dragon.scale})`,
                  filter: `brightness(${dragon.brightness}) drop-shadow(0 0 ${18 + dragon.glow * 54}px rgba(164,20,10,${0.18 + dragon.glow * 0.45}))`,
                  opacity: dragon.opacity,
                }}
              >
                {emblemAvailable ? (
                  <img
                    src={DRAGON_EMBLEM_SRC}
                    alt=""
                    className="h-full w-full object-contain"
                    draggable={false}
                    onError={() => setEmblemAvailable(false)}
                  />
                ) : (
                  <svg viewBox="0 0 300 340" className="h-[94%] w-[94%]" aria-hidden="true">
                    <defs>
                      <linearGradient id="suzukiFallbackGold" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#f8dc78" />
                        <stop offset=".48" stopColor="#b97a20" />
                        <stop offset="1" stopColor="#63300f" />
                      </linearGradient>
                    </defs>
                    <path d="M150 12 268 52v105c0 79-45 137-118 171C77 294 32 236 32 157V52Z" fill="url(#suzukiFallbackGold)" stroke="#f3c65f" strokeWidth="5" />
                    <path d="M195 75c-30-28-72-18-90 8 25-8 42 3 48 17-41-4-70 18-78 52 19-15 40-18 58-10-30 12-47 39-43 69 19-22 42-31 66-28-11 17-12 37-2 59 6-29 22-46 47-54 13-4 24-13 30-25-18 4-32 1-42-10 24-7 40-22 47-45-17 9-35 11-53 4 11-10 16-23 12-37Z" fill="#3a1409" opacity=".86" />
                    <circle cx="181" cy="106" r="5" fill="#ff3f23" />
                  </svg>
                )}
              </div>

              {phase === "text_reveal" && textStage >= 1 ? (
                <div className={`-mt-5 transition-opacity duration-700 ${textFading ? "opacity-0" : "opacity-100"}`}>
                  <div
                    className="text-[19px] font-semibold tracking-[.08em] text-[#cdb5ad] sm:text-[21px]"
                    style={{ animation: "suzukiTextIn .9s ease both", textShadow: "0 0 18px rgba(120,28,18,.44)" }}
                  >
                    覚者よ、よくきた。
                  </div>
                  {textStage >= 2 ? (
                    <div
                      className="mt-5 text-[14px] font-medium leading-7 tracking-[.06em] text-[#ac8b82] sm:text-[15px]"
                      style={{ animation: "suzukiTextIn 1.1s ease both", textShadow: "0 0 18px rgba(120,28,18,.35)" }}
                    >
                      お前の心臓と引き換えに、<br />
                      この紋章を授けよう。
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </button>
      ) : null}

      {showBadgeOverlay ? (
        <div
          className="absolute inset-0 overflow-hidden bg-slate-950/55 p-5 backdrop-blur-sm"
          style={finishOverlay ? { animation: "suzukiFinishFade .85s ease forwards", pointerEvents: "none" } : undefined}
        >
          <div className="mx-auto flex min-h-full max-w-sm items-start justify-center py-4">
            <section className={`relative w-full overflow-hidden rounded-[30px] border border-[#ead5bf] bg-[#fffaf4] p-5 text-center shadow-2xl ${shakeClass}`}>
              <div className="ml-auto size-9" />

              <div className="relative mx-auto mt-1 size-56">
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{ opacity: showSuzukiBurn ? 0 : 1 }}
                >
                  <StampMedal3D
                    imageUrl={capturedImageUrl}
                    fallbackImageUrl={capturedImageUrl}
                    engravingLines={NORMAL_ENGRAVING}
                    className="h-full w-full"
                  />
                </div>
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{ opacity: showSuzukiBurn ? 1 : 0 }}
                >
                  <StampMedal3D
                    imageUrl={capturedImageUrl}
                    fallbackImageUrl={capturedImageUrl}
                    engravingLines={BURNED_ENGRAVING}
                    className="h-full w-full"
                  />
                </div>

                {phase === "fire" ? (
                  <>
                    <div
                      className="absolute inset-[10%] rounded-full mix-blend-multiply transition-opacity duration-700"
                      style={{
                        opacity: fireCooling ? 0.28 : 0.72,
                        background: "radial-gradient(circle at 48% 55%, rgba(255,180,58,.12) 0 18%, rgba(224,71,22,.30) 38%, rgba(101,25,10,.30) 64%, rgba(20,13,10,.12) 78%, transparent 88%)",
                      }}
                    />
                    <div
                      className="absolute inset-[5%] rounded-full"
                      style={{
                        animation: "suzukiHeatWave .17s ease-in-out infinite",
                        backdropFilter: "blur(1.5px)",
                        WebkitBackdropFilter: "blur(1.5px)",
                      }}
                    />
                  </>
                ) : null}
              </div>

              <h2 className="mt-5 text-xl font-black leading-snug text-[#443c35]">SuzukiPM</h2>
              <p className="mt-1 text-xs font-bold text-[#8a7d72]">千葉県</p>

              {phase === "fire" ? (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
                  <div
                    className="absolute -inset-x-[15%] bottom-[-22%] h-[92%] origin-bottom"
                    style={{
                      animation: "suzukiFireBack 2.9s ease-out both",
                      background: "radial-gradient(ellipse at 50% 100%, rgba(255,238,146,.95) 0 12%, rgba(255,133,28,.92) 24%, rgba(199,41,13,.72) 48%, rgba(80,9,4,.20) 68%, transparent 74%)",
                      filter: "blur(9px)",
                      mixBlendMode: "screen",
                    }}
                  />
                  <div
                    className="absolute -inset-x-[20%] bottom-[-18%] h-[84%] origin-bottom"
                    style={{
                      animation: "suzukiFireFront 2.45s cubic-bezier(.22,.7,.35,1) .18s both",
                      background: "radial-gradient(ellipse at 48% 100%, rgba(255,250,194,1) 0 10%, rgba(255,181,54,.98) 18%, rgba(244,73,14,.88) 38%, rgba(133,19,5,.50) 58%, transparent 70%)",
                      filter: "blur(4px)",
                      mixBlendMode: "screen",
                    }}
                  />

                  {Array.from({ length: 22 }, (_, index) => {
                    const left = 12 + ((index * 37) % 78);
                    const sparkX = ((index % 7) - 3) * 16;
                    const sparkY = -(90 + ((index * 31) % 170));
                    return (
                      <span
                        key={index}
                        className="absolute bottom-[16%] size-1.5 rounded-full bg-[#ffd26a] shadow-[0_0_10px_rgba(255,105,26,.9)]"
                        style={{
                          left: `${left}%`,
                          ["--spark-x" as string]: `${sparkX}px`,
                          ["--spark-y" as string]: `${sparkY}px`,
                          animation: `suzukiSpark ${720 + (index % 5) * 130}ms ease-out ${120 + (index % 8) * 95}ms infinite`,
                        }}
                      />
                    );
                  })}

                  {Array.from({ length: 6 }, (_, index) => (
                    <span
                      key={index}
                      className="absolute bottom-[18%] h-24 w-24 rounded-full bg-[#32241f]/45 blur-2xl"
                      style={{
                        left: `${8 + index * 16}%`,
                        animation: `suzukiSmoke ${1800 + index * 130}ms ease-out ${650 + index * 110}ms infinite`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}

      {flash !== "none" ? (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            background:
              flash === "white"
                ? "rgba(255,238,215,.92)"
                : flash === "darkred"
                  ? "rgba(68,0,0,.86)"
                  : "rgba(174,12,5,.48)",
            mixBlendMode: flash === "white" ? "screen" : "normal",
          }}
        />
      ) : null}
    </div>
  );
}
