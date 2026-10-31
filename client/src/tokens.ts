import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Phones keep the refresh token in the OS keystore. On the web the API keeps it in an
// HttpOnly cookie that page scripts can't read, so a reload stays signed in.
export const usesCookie = Platform.OS === 'web';

const KEY = 'edulift.refresh_token';

export async function loadRefreshToken(): Promise<string | null> {
  return usesCookie ? null : SecureStore.getItemAsync(KEY);
}

export async function saveRefreshToken(token: string | null): Promise<void> {
  if (!usesCookie && token) await SecureStore.setItemAsync(KEY, token);
}

export async function forgetRefreshToken(): Promise<void> {
  if (!usesCookie) await SecureStore.deleteItemAsync(KEY);
}
