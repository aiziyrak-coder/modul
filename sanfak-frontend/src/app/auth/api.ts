import { fetchOne, postJson } from '@/shared/api';

export interface LoginPayload {
  oneIdPin: string;
}

export interface LoginTokens {
  accessToken: string;
  refreshToken?: string;
}

export async function loginRequest(payload: LoginPayload): Promise<LoginTokens> {
  return postJson<LoginTokens>('/auth', payload);
}

export async function faceLoginRequest(frames: Blob[]): Promise<LoginTokens> {
  const form = new FormData();
  frames.forEach((blob, i) => form.append('frames', blob, `frame${i}.jpg`));
  return postJson<LoginTokens>('/auth/face-login', form);
}

export interface ProfileResponse {
  _id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  photo?: string;
  role?: {
    _id: string;
    title: string;
    name?: string;
    permissions?: string[];
    scopes?: string[];
  };
  active?: boolean;
}

export async function fetchProfile(): Promise<ProfileResponse> {
  return fetchOne<ProfileResponse>('/auth/profile');
}
