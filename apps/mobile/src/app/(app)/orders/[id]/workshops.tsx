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

import { ProductionBoard, Workshop, WorkshopBatch } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";
import { StepHeader } from "@/components/step-header";

export default function OrderWorkshopsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(
    null,
  );
  const [sentQty, setSentQty] = useState("");
  const [ratePerPiece, setRatePerPiece] = useState("");

  const [receivingBatchId, setReceivingBatchId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState("");

  const { data: batches, isLoading } = useQuery({
    queryKey: ["order-batches", id],
    queryFn: () => apiFetch<WorkshopBatch[]>(`/orders/${id}/workshop-batches`),
    enabled: Boolean(id),
  });

  const { data: board } = useQuery({
    queryKey: ["production", id],
    queryFn: () => apiFetch<ProductionBoard>(`/orders/${id}/production`),
    enabled: Boolean(id),
  });

  const { data: workshops } = useQuery({
    queryKey: ["workshops"],
    queryFn: () => apiFetch<Workshop[]>("/workshops"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order-batches", id] });
    qc.invalidateQueries({ queryKey: ["workshops"] });
    qc.invalidateQueries({ queryKey: ["order", id] });
  };

  const sendBatch = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/workshop-batches`, {
        method: "POST",
        body: {
          orderLineId: selectedLineId,
          workshopId: selectedWorkshopId,
          sentQty: Number(sentQty),
          ratePerPieceMinor: Number(ratePerPiece) || 0,
        },
      }),
    onSuccess: () => {
      setSentQty("");
      setRatePerPiece("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "تعذر الإرسال",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  const receiveBatch = useMutation({
    mutationFn: (vars: { batchId: string; quantity: number }) =>
      apiFetch(`/workshop-batches/${vars.batchId}/receive`, {
        method: "POST",
        body: { quantity: vars.quantity },
      }),
    onSuccess: () => {
      setReceivingBatchId(null);
      setReceiveQty("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "تعذر الاستلام",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  const canSend =
    Boolean(selectedLineId && selectedWorkshopId) && Number(sentQty) > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepHeader orderId={id} stepType="WORKSHOP" />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>إرسال دفعة للمشغل</Text>

        <Text style={styles.label}>اختر اللون والمقاس:</Text>
        <View style={styles.chipWrap}>
          {(board?.lines ?? []).map((l) => {
            const active = l.id === selectedLineId;
            return (
              <Pressable
                key={l.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedLineId(l.id)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {l.color} ({l.size}) — مقصوص: {l.cutQty}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>اختر المشغل:</Text>
        <View style={styles.chipWrap}>
          {(workshops ?? []).map((w) => {
            const active = w.id === selectedWorkshopId;
            return (
              <Pressable
                key={w.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedWorkshopId(w.id)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {w.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="العدد المرسل"
            value={sentQty}
            onChangeText={setSentQty}
            keyboardType="numeric"
            textAlign="right"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="أجرة القطعة"
            value={ratePerPiece}
            onChangeText={setRatePerPiece}
            keyboardType="numeric"
            textAlign="right"
          />
        </View>

        <Pressable
          style={[
            styles.primaryBtn,
            (!canSend || sendBatch.isPending) && { opacity: 0.5 },
          ]}
          disabled={!canSend || sendBatch.isPending}
          onPress={() => sendBatch.mutate()}
        >
          <Text style={styles.btnText}>إرسال للمشغل</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        الدفعات المرسلة ({batches?.length ?? 0})
      </Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        (batches ?? []).map((b) => {
          const isReceiving = receivingBatchId === b.id;
          return (
            <View key={b.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{b.workshop.name}</Text>
                <Text style={styles.meta}>
                  {b.orderLine.color} ({b.orderLine.size})
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>مرسل: {b.sentQty}</Text>
                <Text style={[styles.meta, { color: "#16a34a" }]}>
                  مستلم: {b.receivedQty}
                </Text>
                <Text
                  style={[styles.meta, { color: "#dc2626", fontWeight: "700" }]}
                >
                  متبقي: {b.remainingQty}
                </Text>
              </View>

              {b.remainingQty > 0 ? (
                <>
                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: "#16a34a" }]}
                    onPress={() => {
                      setReceiveQty("");
                      setReceivingBatchId(isReceiving ? null : b.id);
                    }}
                  >
                    <Text style={styles.btnText}>
                      {isReceiving ? "إلغاء" : "استلام قطع جاهزة"}
                    </Text>
                  </Pressable>

                  {isReceiving ? (
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="العدد المستلم"
                        value={receiveQty}
                        onChangeText={setReceiveQty}
                        keyboardType="numeric"
                        textAlign="right"
                      />
                      <Pressable
                        style={styles.confirmBtn}
                        disabled={!Number(receiveQty) || receiveBatch.isPending}
                        onPress={() =>
                          receiveBatch.mutate({
                            batchId: b.id,
                            quantity: Number(receiveQty),
                          })
                        }
                      >
                        <Text style={styles.btnText}>تأكيد</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12, backgroundColor: "#f9fafb", flexGrow: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 13, color: "#4b5563" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { fontSize: 12, color: "#111827" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  title: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 13, color: "#4b5563" },
});
