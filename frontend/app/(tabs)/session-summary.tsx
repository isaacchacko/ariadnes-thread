// app/session-summary.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text, Button, Image, ScrollView } from "react-native";
import { loadSession } from "../lib/storage";
import { Session } from "../types/session";

export default function SessionSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sess, setSess] = useState<Session | null>(null);

  useEffect(() => {
    (async () => setSess(id ? await loadSession(id) : null))();
  }, [id]);

  useEffect(() => {
    (async () => {
      const loaded = id ? await loadSession(id) : null;
      console.log('Loaded session:', loaded);
      setSess(loaded);
    })();
  }, [id]);

  if (!sess) return <Text>Loading...</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text>Session: {sess.id}</Text>
      <Text>Waypoints: {sess.stats.nNodes}</Text>
      
      <Text>Duration: {Math.round(sess.stats.elapsedMs / 1000)}s</Text>
      {sess.nodes.map((wp) => (
        
        <View key={wp.id} style={{ marginVertical: 8 }}>
          <Text>Waypoint {wp.id}</Text>
          <Text>Timestamp: {wp.tMs} ms</Text>
          <Text>Heading: {wp.headingDeg}</Text>
          {wp.photoUri && (
            <Image source={{ uri: wp.photoUri }} style={{ width: 120, height: 160, borderRadius: 8 }} />
          )}
          {wp.label && (
  <Text style={{ marginTop: 4, fontStyle: 'italic', color: '#fff' }}>Label: {wp.label}</Text>
)}
        </View>
      ))}
      <Button title="Back to Sessions" onPress={() => router.push("/(tabs)/session")} />
    </ScrollView>
  );
}
