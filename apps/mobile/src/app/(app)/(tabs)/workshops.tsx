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
  const [sendNote, setSendNote] = useState("");

  const [receivingBatchId, setReceivingBatchId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveNote, setReceiveNote] = useState("");

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
          note: sendNote.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setSentQty("");
      setRatePerPiece("");
      setSendNote("");
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
    mutationFn: (vars: { batchId: string; quantity: number; note?: string }) =>
      apiFetch(`/workshop-batches/${vars.batchId}/receive`, {
        method: "POST",
        body: { quantity: vars.quantity, note: vars.note },
      }),
    onSuccess: () => {
      setReceivingBatchId(null);
      setReceiveQty("");
      setReceiveNote("");
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

        <TextInput
          style={styles.input}
          placeholder="ملاحظة على الدفعة (اختياري)"
          value={sendNote}
          onChangeText={setSendNote}
          textAlign="right"
        />

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

              {b.note ? (
                <Text style={styles.batchNote}>ملاحظة الدفعة: {b.note}</Text>
              ) : null}

              {b.receipts.length > 0 ? (
                <View style={styles.history}>
                  <Text style={styles.historyTitle}>
                    ما تم إنجازه واستلامه ({b.receipts.length})
                  </Text>
                  {b.receipts.map((r) => (
                    <View key={r.id} style={styles.historyRow}>
                      <Text style={styles.historyQty}>+{r.quantity}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyDate}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </Text>
                        {r.note ? (
                          <Text style={styles.historyNote}>{r.note}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

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
                    <View style={{ gap: 8 }}>
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
                          disabled={
                            !Number(receiveQty) || receiveBatch.isPending
                          }
                          onPress={() =>
                            receiveBatch.mutate({
                              batchId: b.id,
                              quantity: Number(receiveQty),
                              note: receiveNote.trim() || undefined,
                            })
                          }
                        >
                          <Text style={styles.btnText}>تأكيد</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="ماذا أنجز المشغل؟ (ملاحظة اختيارية)"
                        value={receiveNote}
                        onChangeText={setReceiveNote}
                        textAlign="right"
                      />
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
  batchNote: { fontSize: 13, color: "#1f2937" },
  history: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  historyTitle: { fontSize: 13, fontWeight: "700", color: "#374151" },
  historyRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  historyQty: {
    fontSize: 15,
    fontWeight: "800",
    color: "#16a34a",
    minWidth: 44,
  },
  historyDate: { fontSize: 12, color: "#6b7280" },
  historyNote: { fontSize: 13, color: "#374151" },
  title: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 13, color: "#4b5563" },
});
