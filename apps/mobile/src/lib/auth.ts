// Mobile auth token storage. The JWT comes from the shared API's
// user.mobileLogin mutation and is kept in the device's secure enclave
// (Keychain on iOS, Keystore on Android) via expo-secure-store.
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "coursemind_token";

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
