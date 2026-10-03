import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOutlined } from '@ant-design/icons';

const FRAME_COUNT = 2;
const FRAME_GAP_MS = 700;

interface Props {
  disabled?: boolean;
  onCapture: (frames: Blob[]) => Promise<boolean>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function FaceLoginPanel({ disabled, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Brauzer kameraga ruxsat bermaydi (HTTPS kerak).');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setError('Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.');
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  const grabFrame = (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return Promise.resolve(null);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
  };

  const scan = async () => {
    if (busy || disabled || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const frames: Blob[] = [];
      for (let i = 0; i < FRAME_COUNT; i += 1) {
        if (i > 0) await sleep(FRAME_GAP_MS);
        const blob = await grabFrame();
        if (!blob) throw new Error('frame');
        frames.push(blob);
      }
      await onCapture(frames);
    } catch {
      setError('Kadr olib bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card-bg-title">Yuz orqali kiring</div>
      <div className="card-bg-desc">
        Kameraga to‘g‘ri qarang, yuzingiz yorug‘ va ochiq bo‘lsin. Tizim ketma-ket 2 ta kadr oladi.
      </div>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: '100%',
          maxHeight: 260,
          borderRadius: 12,
          background: '#000',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      {error ? (
        <div role="alert" style={{ color: '#d4380d', marginTop: 8, fontSize: 13 }}>
          {error}
        </div>
      ) : null}
      <button
        type="button"
        className="login-btn"
        disabled={disabled || busy || !ready}
        onClick={() => void scan()}
      >
        <CameraOutlined /> {busy ? 'Tekshirilmoqda…' : 'Yuzni skanerlash'}
      </button>
    </div>
  );
}
