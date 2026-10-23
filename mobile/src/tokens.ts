import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Where the session lives between launches.
//
// Phones: the OS keychain/keystore via expo-secure-store.
// Web: nowhere. There is no safe place for a refresh token in a browser that page
// scripts can't read, so on web you sign in again after a reload.

const KEY = 'edulift.refresh_token';
let webRefreshToken: string | null = null;

export async function loadRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webRefreshToken;
  return SecureStore.getItemAsync(KEY);
}

export async function saveRefreshToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webRefreshToken = token;
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function forgetRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webRefreshToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
