import { create } from 'zustand';
import type { ComponentType } from 'react';

export interface ModalConfig {
  title?: string;
  maxWidth?: string;
  maxHeight?: string;
  bodyPadding?: string;
  overflow?: boolean;
  withHeader?: boolean;
  right?: boolean;
  body?: ComponentType;
}

interface ModalState {
  show: boolean;
  animating: boolean;
  loading: boolean;
  config: ModalConfig;
  showModal: (config: ModalConfig) => void;
  hideModal: () => void;
  setModalLoading: (loading: boolean) => void;
}

export const MODAL_LEAVE_MS = 120;

let leaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useModalStore = create<ModalState>((set) => ({
  show: false,
  animating: false,
  loading: false,
  config: {},

  showModal: (config) => {
    if (leaveTimer !== null) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
    set({ show: true, animating: true, loading: false, config });
  },

  hideModal: () => {
    set({ animating: false });
    if (leaveTimer !== null) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      set({ show: false, config: {} });
    }, MODAL_LEAVE_MS);
  },

  setModalLoading: (loading) => set({ loading }),
}));
