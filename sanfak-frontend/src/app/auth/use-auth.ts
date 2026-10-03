import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import {
  clearTokens,
  getApiErrorMessage,
  hasAccessToken,
  postJson,
  setAccessToken,
  setRefreshToken,
  startTokenRefreshScheduler,
  stopTokenRefreshScheduler,
} from '@/shared/api';
import { useSessionStore } from '@/app/session';
import { faceLoginRequest, fetchProfile, loginRequest } from './api';
import type { ProfileResponse } from './api';

function permissionsFromProfile(profile: ProfileResponse): string[] {
  if (profile.role?.title === 'super_admin') return ['*'];
  const perms = profile.role?.permissions ?? profile.role?.scopes ?? [];
  if (perms.length > 0) {
    return perms.map((p) => p.replace('_', ':'));
  }
  return [];
}

export function useAuth() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clear);
  const setStatus = useSessionStore((s) => s.setStatus);

  const applyProfile = useCallback(
    (profile: ProfileResponse) => {
      setSession({
        user: {
          id: profile._id,
          email: profile.email ?? '',
          fullName: [profile.lastName, profile.firstName, profile.middleName]
            .filter(Boolean)
            .join(' '),
          roles: profile.role
            ? [{ id: profile.role._id, name: profile.role.title ?? profile.role.name ?? '' }]
            : [],
        },
        permissions: permissionsFromProfile(profile),
      });
    },
    [setSession],
  );

  const login = useCallback(
    async (oneIdPin: string): Promise<boolean> => {
      setStatus('loading');
      try {
        const { accessToken, refreshToken } = await loginRequest({ oneIdPin });
        setAccessToken(accessToken);
        setRefreshToken(refreshToken ?? null);

        const profile = await fetchProfile();
        applyProfile(profile);
        startTokenRefreshScheduler();

        message.success(`Xush kelibsiz, ${profile.firstName}!`);
        navigate('/');
        return true;
      } catch (error) {
        stopTokenRefreshScheduler();
        clearTokens();
        setStatus('unauthenticated');
        message.error(getApiErrorMessage(error, 'Login amalga oshmadi'));
        return false;
      }
    },
    [applyProfile, message, navigate, setStatus],
  );

  const loginWithFace = useCallback(
    async (frames: Blob[]): Promise<boolean> => {
      setStatus('loading');
      try {
        const { accessToken, refreshToken } = await faceLoginRequest(frames);
        setAccessToken(accessToken);
        setRefreshToken(refreshToken ?? null);

        const profile = await fetchProfile();
        applyProfile(profile);
        startTokenRefreshScheduler();

        message.success(`Xush kelibsiz, ${profile.firstName}!`);
        navigate('/');
        return true;
      } catch (error) {
        stopTokenRefreshScheduler();
        clearTokens();
        setStatus('unauthenticated');
        message.error(getApiErrorMessage(error, 'Yuz bilan kirish amalga oshmadi'));
        return false;
      }
    },
    [applyProfile, message, navigate, setStatus],
  );

  const logout = useCallback(async () => {
    try {
      await postJson('/auth/logout', {});
    } catch {}
    stopTokenRefreshScheduler();
    clearTokens();
    clearSession();
    navigate('/login', { replace: true });
  }, [clearSession, navigate]);

  const bootstrap = useCallback(async () => {
    if (!hasAccessToken()) return;
    try {
      setStatus('loading');
      const profile = await fetchProfile();
      applyProfile(profile);
      startTokenRefreshScheduler();
    } catch {
      stopTokenRefreshScheduler();
      clearTokens();
      setStatus('unauthenticated');
    }
  }, [applyProfile, setStatus]);

  return { login, loginWithFace, logout, bootstrap };
}
