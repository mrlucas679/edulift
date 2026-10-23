import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Phones keep the refresh token in the OS keystore.
// Web keeps it in memory only, so a reload signs you out.

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
