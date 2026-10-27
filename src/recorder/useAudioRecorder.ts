// React hook bridging the framework-agnostic AudioRecorder to component state.
//
// Owns: recorder phase, elapsed timer, the resulting audio Blob + object URL,
// and typed error state. Guarantees cleanup of the object URL and the
// recorder's microphone tracks on unmount.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioRecorder,
  RecorderError,
  type RecorderErrorKind,
} from "./audioRecorder";

export type RecorderPhase =
  | "idle" // not yet started
  | "requesting" // asking for mic permission
  | "recording" // actively recording
  | "stopping" // finalizing the blob
  | "recorded" // finished, playback available
  | "error"; // see `error`

export interface RecorderErrorState {
  kind: RecorderErrorKind;
  message: string;
}

export interface UseAudioRecorder {
  phase: RecorderPhase;
  elapsedMs: number;
  audioUrl: string | null;
  error: RecorderErrorState | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => void;
}

export function useAudioRecorder(): UseAudioRecorder {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const audioUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<RecorderErrorState | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokeUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    revokeUrl();
    setAudioUrl(null);
    setElapsedMs(0);
    setPhase("requesting");

    const recorder = new AudioRecorder();
    recorderRef.current = recorder;

    try {
      await recorder.start();
    } catch (err) {
      recorderRef.current = null;
      const e =
        err instanceof RecorderError
          ? { kind: err.kind, message: err.message }
          : { kind: "unknown" as const, message: "Recording failed." };
      setError(e);
      setPhase("error");
      return;
    }

    startedAtRef.current = Date.now();
    setPhase("recording");
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
  }, [revokeUrl, stopTimer]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setPhase("stopping");
    stopTimer();

    try {
      const blob = await recorder.stop();
      recorderRef.current = null;
      if (blob) {
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setPhase("recorded");
      } else {
        setError({
          kind: "unknown",
          message: "No audio was captured. Try recording again.",
        });
        setPhase("error");
      }
    } catch (err) {
      recorderRef.current = null;
      const e =
        err instanceof RecorderError
          ? { kind: err.kind, message: err.message }
          : { kind: "unknown" as const, message: "Recording failed." };
      setError(e);
      setPhase("error");
    }
  }, [stopTimer]);

  const cancel = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    stopTimer();
    revokeUrl();
    setAudioUrl(null);
    setElapsedMs(0);
    setError(null);
    setPhase("idle");
  }, [revokeUrl, stopTimer]);

  // Final safety net: release everything if the component unmounts mid-record.
  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      stopTimer();
      revokeUrl();
    };
  }, [revokeUrl, stopTimer]);

  return { phase, elapsedMs, audioUrl, error, start, stop, cancel };
}
