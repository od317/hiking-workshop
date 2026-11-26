import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StepHeader } from "@/components/step-header";
import { PhotoGallery } from "@/components/photo-gallery";
import { OrderDetail } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

export default function PatternScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });

  const createPattern = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/patterns`, {
        method: "POST",
        body: { note: note.trim() || undefined },
      }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) =>
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر إضافة الباترون",
      ),
  });

  if (isLoading || !order) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepHeader orderId={id} stepType="PATTERN" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          الباترون ({order.patterns.length})
        </Text>

        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="ملاحظة على الباترون..."
            value={note}
            onChangeText={setNote}
            textAlign="right"
          />
          <Pressable
            style={styles.primaryBtn}
            disabled={createPattern.isPending}
            onPress={() => createPattern.mutate()}
          >
            <Text style={styles.btnText}>+ إصدار</Text>
          </Pressable>
        </View>

        {order.patterns.length === 0 ? (
          <Text style={styles.empty}>لا يوجد باترون بعد</Text>
        ) : (
          order.patterns.map((p) => (
            <View key={p.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>باترون v{p.versionNum}</Text>
              {p.note ? <Text style={styles.itemNote}>{p.note}</Text> : null}
              <PhotoGallery
                entityType="PATTERN"
                entityId={p.id}
                label="صور الباترون"
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 16, backgroundColor: "#f9fafb", flexGrow: 1 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  inlineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  itemCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  itemNote: { fontSize: 13, color: "#4b5563" },
  empty: { color: "#6b7280", fontSize: 13 },
});
