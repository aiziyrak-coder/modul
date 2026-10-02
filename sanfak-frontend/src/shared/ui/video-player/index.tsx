import { useRef, useState, useCallback, type SyntheticEvent } from 'react';
import styled from 'styled-components';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined,
  MutedOutlined,
  FullscreenOutlined,
  FastForwardOutlined,
  FastBackwardOutlined,
  ExpandAltOutlined,
} from '@ant-design/icons';

const Wrap = styled.div`
  position: relative;
  background: #000;
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &:fullscreen { border-radius: 0; }
  &:-webkit-full-screen { border-radius: 0; }
`;

const Video = styled.video`
  width: 100%;
  display: block;
  cursor: pointer;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px 12px;
  background: rgba(0, 0, 0, 0.72);
`;

const Progress = styled.input`
  width: 100%;
  accent-color: var(--brand-primary, #37cb94);
  cursor: pointer;
  height: 4px;
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CtrlBtn = styled.button`
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  opacity: 0.9;
  transition: opacity 0.15s;

  &:hover { opacity: 1; }
`;

const TimeText = styled.span`
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  white-space: nowrap;
`;

const VolumeInput = styled.input`
  width: 70px;
  accent-color: var(--brand-primary, #37cb94);
  cursor: pointer;
  height: 3px;
`;

const Spacer = styled.div`
  flex: 1;
`;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export interface VideoPlayerProps {
  src: string;
  poster?: string;
}

export function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const handleTimeUpdate = (e: SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setCurrent(v.currentTime);
    setProgress(duration ? (v.currentTime / duration) * 100 : 0);
  };

  const handleLoaded = (e: SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const pct = Number(e.target.value);
    v.currentTime = (pct / 100) * duration;
    setProgress(pct);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const val = Number(e.target.value);
    if (v) { v.volume = val; v.muted = val === 0; }
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && volume === 0) { v.volume = 0.5; setVolume(0.5); }
  };

  const skip = (secs: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.currentTime + secs, duration));
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <Wrap ref={wrapRef}>
      <Video
        ref={videoRef}
        src={src}
        poster={poster}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onEnded={() => setPlaying(false)}
      />
      <Controls>
        <Progress
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={seek}
        />
        <BottomRow>
          <CtrlBtn onClick={() => skip(-10)} title="-10s">
            <FastBackwardOutlined />
          </CtrlBtn>
          <CtrlBtn onClick={togglePlay} title={playing ? 'Pauza' : 'Ijro'}>
            {playing ? <PauseCircleOutlined style={{ fontSize: 24 }} /> : <PlayCircleOutlined style={{ fontSize: 24 }} />}
          </CtrlBtn>
          <CtrlBtn onClick={() => skip(10)} title="+10s">
            <FastForwardOutlined />
          </CtrlBtn>

          <CtrlBtn onClick={toggleMute}>
            {muted ? <MutedOutlined /> : <SoundOutlined />}
          </CtrlBtn>
          <VolumeInput
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={changeVolume}
          />

          <TimeText>{fmt(current)} / {fmt(duration)}</TimeText>
          <Spacer />
          <CtrlBtn onClick={fullscreen} title="To'liq ekran">
            {document.fullscreenElement ? <ExpandAltOutlined /> : <FullscreenOutlined />}
          </CtrlBtn>
        </BottomRow>
      </Controls>
    </Wrap>
  );
}
