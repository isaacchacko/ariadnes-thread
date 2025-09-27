import React, { useEffect, useState } from "react";
import { View, Text, Button, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { listSessions } from "../lib/storage";

export default function SessionsTab() {
  const router = useRouter();
  const [items, setItems] = useState<Array<{ id: string; jsonPath: string; createdAt: number }>>([]);

  useEffect(() => { (async () => setItems(await listSessions()))(); }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text>Saved sessions</Text>
      {items.map((s) => (
        <Button
          key={s.id}
          title={`${s.id} • ${new Date(s.createdAt).toLocaleString()}`}
          onPress={() => router.push({ pathname: "/session-summary", params: { id: s.id } })}
        />
      ))}
    </ScrollView>
  );
}
