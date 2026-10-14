import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lp.app.default.server";

export async function saveDefaultServer(panelId: string) {
  await AsyncStorage.setItem(KEY, panelId);
}

export async function getDefaultServer() {
  return AsyncStorage.getItem(KEY);
}

export async function clearDefaultServer() {
  await AsyncStorage.removeItem(KEY);
}
