import type { ReactNode } from 'react';

export interface BackendNotification {
  _id: string;
  eventType: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationVM {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  bodyLines: string[];
  metadata: Record<string, unknown> | null;
  rawLink: string | null;
  safeLink: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export type Shape = 'title-only' | 'single-line' | 'multiline';

export type Emphasis = 'title' | 'body';

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export type MetaFieldFormat = 'text' | 'date' | 'count' | 'id' | 'arrayCount';

export interface MetaFieldDescriptor {
  key: string;
  labelKey: string;
  fmt: MetaFieldFormat;
}

export interface RendererDescriptor {
  shape: Shape;
  emphasis: Emphasis;
  tone: Tone;
  icon: ReactNode;
  moduleLabelKey: string;
  codeKind?: 'letter' | 'docNumber';
  metaFields?: MetaFieldDescriptor[];
  truncatedUpstream?: true;
  missingReason?: true;
  bodySanitizer?: (body: string) => string;
}

export interface ChannelPrefs {
  inApp: boolean;
  telegram: boolean;
  email: boolean;
  sms: boolean;
}

export type ChannelKey = keyof ChannelPrefs;

export interface DigestPrefs {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string;
  lastSentAt?: string | null;
}

export interface BackendPreferences {
  preferences: Record<string, ChannelPrefs>;
  digest: DigestPrefs;
  paused: boolean;
  pausedUntil: string | null;
}

export interface PreferencesInput {
  preferences?: Record<string, ChannelPrefs>;
  digest?: DigestPrefs;
  paused?: boolean;
  pausedUntil?: string | null;
}
