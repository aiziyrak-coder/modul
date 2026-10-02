import { useEffect, useRef, useState } from 'react';
import {
  CaretRightFilled,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PauseOutlined,
  SoundFilled,
} from '@ant-design/icons';

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function youtubeEmbed(url: string): string | null {
  const m = url.match(/[?&]v=([^&#]+)/) ?? url.match(/youtu\.be\/([^?&#]+)/);
  return m && m[1] ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1` : null;
}

const FRAME: React.CSSProperties = {
  borderRadius: 'var(--radius-xl, 16px)',
  overflow: 'hidden',
  background: '#0b0f14',
  boxShadow: '0 16px 44px rgba(15, 23, 42, 0.28)',
  border: '1px solid color-mix(in srgb, var(--brand-primary) 22%, #000)',
};

export function VideoPlayer({
  url,
  title,
  onWatchedChange,
  disableSeek,
}: {
  url: string;
  title?: string;
  onWatchedChange?: (watched: boolean) => void;
  disableSeek?: boolean;
}) {
  const embed = url ? youtubeEmbed(url) : null;
  if (embed) return <EmbedPlayer embed={embed} title={title} onWatchedChange={onWatchedChange} />;
  return <NativePlayer url={url} onWatchedChange={onWatchedChange} disableSeek={disableSeek} />;
}

function EmbedPlayer({
  embed,
  title,
  onWatchedChange,
}: {
  embed: string;
  title?: string;
  onWatchedChange?: (watched: boolean) => void;
}) {
  useEffect(() => {
    onWatchedChange?.(true);
  }, [onWatchedChange]);
  return (
    <div style={FRAME}>
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
        <iframe
          src={embed}
          title={title ?? 'video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </div>
  );
}

function NativePlayer({
  url,
  onWatchedChange,
  disableSeek,
}: {
  url: string;
  onWatchedChange?: (watched: boolean) => void;
  disableSeek?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const watchedRef = useRef(false);
  const maxRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableSeek) return;
    const v = videoRef.current;
    if (!v || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * dur;
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const toggleFull = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const pct = dur ? (cur / dur) * 100 : 0;
  const controlsVisible = hover || !playing;

  return (
    <div
      ref={wrapRef}
      style={{
        ...FRAME,
        position: 'relative',
        lineHeight: 0,
        ...(full
          ? {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              borderRadius: 0,
              border: 'none',
            }
          : {}),
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <video
        ref={videoRef}
        src={url}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCur(v.currentTime);
          if (v.currentTime > maxRef.current) maxRef.current = v.currentTime;
          if (!watchedRef.current && v.duration > 0 && v.currentTime / v.duration >= 0.9) {
            watchedRef.current = true;
            onWatchedChange?.(true);
          }
        }}
        onSeeking={() => {
          const v = videoRef.current;
          if (!v || !disableSeek) return;
          if (v.currentTime > maxRef.current + 0.4) v.currentTime = maxRef.current;
        }}
        onEnded={() => {
          if (!watchedRef.current) {
            watchedRef.current = true;
            onWatchedChange?.(true);
          }
        }}
        onLoadedMetadata={() => setDur(videoRef.current?.duration ?? 0)}
        style={{
          display: 'block',
          cursor: 'pointer',
          background: '#000',
          ...(full
            ? { width: '100%', height: '100%', objectFit: 'contain' as const }
            : { width: '100%', maxHeight: '60vh' }),
        }}
      />

      {!playing ? (
        <button
          type="button"
          onClick={toggle}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 30,
            background: 'color-mix(in srgb, var(--brand-primary) 82%, transparent)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <CaretRightFilled style={{ marginLeft: 4 }} />
        </button>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '28px 14px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity .2s ease',
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}
      >
        <CtrlButton onClick={toggle} label="play/pause">
          {playing ? <PauseOutlined /> : <CaretRightFilled />}
        </CtrlButton>

        <div
          onClick={disableSeek ? undefined : seek}
          style={{
            flex: 1,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            cursor: disableSeek ? 'default' : 'pointer',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.28)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, background: 'var(--brand-primary, #37cb94)' }} />
            {!disableSeek ? (
              <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            ) : null}
          </div>
        </div>

        <span style={{ color: '#fff', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1 }}>
          {fmt(cur)} / {fmt(dur)}
        </span>

        <CtrlButton onClick={toggleMute} label="mute" dim={muted}>
          <SoundFilled />
        </CtrlButton>
        <CtrlButton onClick={toggleFull} label="fullscreen">
          {full ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </CtrlButton>
      </div>
    </div>
  );
}

function CtrlButton({
  onClick,
  label,
  dim,
  children,
}: {
  onClick: () => void;
  label: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        color: '#fff',
        cursor: 'pointer',
        fontSize: 16,
        lineHeight: 0,
        padding: 4,
        opacity: dim ? 0.45 : 0.92,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}
