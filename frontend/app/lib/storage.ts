// app/lib/storage.ts
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "../types/session";

const INDEX_KEY = "@maps:index";

export async function saveSession(sess: Session) {
  const path = FileSystem.documentDirectory + `${sess.id}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(sess));
  const raw = (await AsyncStorage.getItem(INDEX_KEY)) || "[]";
  const idx = JSON.parse(raw) as Array<{ id: string; jsonPath: string; createdAt: number }>;
  idx.push({ id: sess.id, jsonPath: path, createdAt: Date.now() });
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  return { path };
}

export async function listSessions() {
  const raw = (await AsyncStorage.getItem(INDEX_KEY)) || "[]";
  return JSON.parse(raw) as Array<{ id: string; jsonPath: string; createdAt: number }>;
}

export async function loadSession(id: string) {
  const idx = await listSessions();
  const rec = idx.find((i) => i.id === id);
  if (!rec) return null;
  const json = await FileSystem.readAsStringAsync(rec.jsonPath);
  return JSON.parse(json) as Session;
}
