import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { OrderDetail, OrderStepStatus, OrderStepType } from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS, STEP_LABELS } from "@/lib/step-labels";
import { ApiError, apiFetch } from "@/lib/api-client";

const NEXT_STATUS: Record<OrderStepStatus, OrderStepStatus> = {
  NOT_STARTED: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "NOT_STARTED",
  BLOCKED: "IN_PROGRESS",
  SKIPPED: "NOT_STARTED",
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });

  const updateStep = useMutation({
    mutationFn: (vars: { stepType: OrderStepType; status: OrderStepStatus }) =>
      apiFetch(`/orders/${id}/steps/${vars.stepType}`, {
        method: "PATCH",
        body: { status: vars.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => {
      Alert.alert(
        "لا يمكن تغيير الحالة",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  const reorderSteps = useMutation({
    mutationFn: (newOrder: OrderStepType[]) =>
      apiFetch(`/orders/${id}/steps/reorder`, {
        method: "PATCH",
        body: { order: newOrder },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر إعادة الترتيب",
      );
    },
  });

  if (isLoading || !order) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.steps.length) return;
    const types = order.steps.map((s) => s.type);
    [types[index], types[target]] = [types[target], types[index]];
    reorderSteps.mutate(types);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.title}>{order.title || "بدون عنوان"}</Text>
        <Text style={styles.meta}>الزبون: {order.customer.name}</Text>
        {order.note ? <Text style={styles.note}>{order.note}</Text> : null}
      </View>
      <Pressable
        style={{
          backgroundColor: "#111827",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 8,
        }}
        onPress={() => router.push(`/(app)/orders/${id}/materials`)}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          القماش والإكسسوارات
        </Text>
      </Pressable>
      <Pressable
        style={{
          backgroundColor: "#111827",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 8,
        }}
        onPress={() => router.push(`/(app)/orders/${id}/production`)}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>القص والإنتاج</Text>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          style={{
            backgroundColor: "#111827",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 8,
          }}
          onPress={() => router.push(`/(app)/orders/${id}/design`)}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            الباترون والعينة
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        مراحل الطلب (اضغط لتغيير الحالة أو ↑↓ للترتيب)
      </Text>

      {order.steps.map((step, index) => (
        <View key={step.id} style={styles.stepRow}>
          <View style={styles.reorderBtns}>
            <Pressable
              style={styles.arrowBtn}
              disabled={index === 0 || reorderSteps.isPending}
              onPress={() => moveStep(index, -1)}
            >
              <Text style={styles.arrowText}>↑</Text>
            </Pressable>
            <Pressable
              style={styles.arrowBtn}
              disabled={
                index === order.steps.length - 1 || reorderSteps.isPending
              }
              onPress={() => moveStep(index, 1)}
            >
              <Text style={styles.arrowText}>↓</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.stepName}>
              {index + 1}. {STEP_LABELS[step.type]}
            </Text>
          </View>

          <Pressable
            style={[
              styles.statusBadge,
              { backgroundColor: STATUS_COLORS[step.status] },
            ]}
            onPress={() =>
              updateStep.mutate({
                stepType: step.type,
                status: NEXT_STATUS[step.status],
              })
            }
          >
            <Text style={styles.statusText}>{STATUS_LABELS[step.status]}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 10, backgroundColor: "#f9fafb", flexGrow: 1 },
  headerCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  orderNumber: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  title: { fontSize: 18, fontWeight: "700" },
  meta: { fontSize: 14, color: "#4b5563" },
  note: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  reorderBtns: { flexDirection: "row", gap: 4 },
  arrowBtn: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  arrowText: { fontSize: 14, fontWeight: "700" },
  stepName: { fontSize: 15, fontWeight: "600" },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
