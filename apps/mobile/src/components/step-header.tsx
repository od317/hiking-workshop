import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  FulfillmentSummary,
  OrderDetail,
  OrderStepStatus,
  OrderStepType,
  ProductionBoard,
  WorkshopBatch,
} from "@/lib/api";
import { STATUS_COLORS, STATUS_LABELS, STEP_LABELS } from "@/lib/step-labels";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PhotoGallery } from "@/components/photo-gallery";
interface StepHeaderProps {
  orderId: string;
  stepType: OrderStepType;
}

const STEP_STAGE_INDEX: Record<OrderStepType, number> = {
  PATTERN: 1,
  SAMPLE: 2,
  ACCESSORIES: 3,
  CLOTH: 4,
  CUTTING: 5,
  WORKSHOP: 6,
  FINISHING: 7,
  FINAL_CHECK: 8,
  DELIVERY: 9,
};

export function StepHeader({ orderId, stepType }: StepHeaderProps) {
  const qc = useQueryClient();
  const stageIdx = STEP_STAGE_INDEX[stepType];

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${orderId}`),
    enabled: Boolean(orderId),
  });

  const { data: board } = useQuery({
    queryKey: ["production", orderId],
    queryFn: () => apiFetch<ProductionBoard>(`/orders/${orderId}/production`),
    enabled: Boolean(orderId) && stageIdx >= 5,
  });

  const { data: batches } = useQuery({
    queryKey: ["order-batches", orderId],
    queryFn: () =>
      apiFetch<WorkshopBatch[]>(`/orders/${orderId}/workshop-batches`),
    enabled: Boolean(orderId) && stageIdx >= 7,
  });

  const { data: fulfillment } = useQuery({
    queryKey: ["fulfillment", orderId],
    queryFn: () =>
      apiFetch<FulfillmentSummary>(`/orders/${orderId}/fulfillment`),
    enabled: Boolean(orderId) && stageIdx >= 8,
  });

  const updateStep = useMutation({
    mutationFn: (status: OrderStepStatus) =>
      apiFetch(`/orders/${orderId}/steps/${stepType}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => {
      Alert.alert(
        "لا يمكن تحديث الحالة",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  const currentStep = order?.steps.find((s) => s.type === stepType);
  const isDone = currentStep?.status === "DONE";

  // Build carry-over warnings from previous stages
  const pendingFromPrevious: string[] = [];

  if (stageIdx > 5 && board) {
    for (const line of board.lines) {
      if (line.remainingToCut > 0) {
        pendingFromPrevious.push(
          `القص: متبقي ${line.remainingToCut} قطعة من ${line.color} (${line.size}) لم تُقص بعد`,
        );
      }
    }
    for (const hold of board.openHolds) {
      pendingFromPrevious.push(
        `معلق (${STEP_LABELS[hold.stage]}): ${hold.quantity} × ${hold.orderLine.color} (${hold.orderLine.size}) — ${hold.reason}`,
      );
    }
  }

  if (stageIdx > 6 && batches) {
    for (const b of batches) {
      if (b.remainingQty > 0) {
        pendingFromPrevious.push(
          `المشغل (${b.workshop.name}): متبقي ${b.remainingQty} قطعة من ${b.orderLine.color} (${b.orderLine.size}) لم تُستلم بعد`,
        );
      }
    }
  }

  if (stageIdx > 7 && fulfillment) {
    for (const l of fulfillment.lines) {
      const uninspected = l.finishedQty - (l.qcPassedQty + l.qcRejectedQty);
      if (stageIdx === 9 && uninspected > 0) {
        pendingFromPrevious.push(
          `الفحص النهائي: ${uninspected} قطعة من ${l.color} (${l.size}) بانتظار الفحص`,
        );
      }
    }
  }

  return (
    <View style={{ gap: 10 }}>
      {currentStep ? (
        <>
          <View style={styles.statusBar}>
            <View style={styles.row}>
              <Text style={styles.stepTitle}>{STEP_LABELS[stepType]}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: STATUS_COLORS[currentStep.status] },
                ]}
              >
                <Text style={styles.badgeText}>
                  {STATUS_LABELS[currentStep.status]}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.completeBtn,
                { backgroundColor: isDone ? "#6b7280" : "#16a34a" },
                updateStep.isPending && { opacity: 0.6 },
              ]}
              disabled={updateStep.isPending}
              onPress={() => updateStep.mutate(isDone ? "IN_PROGRESS" : "DONE")}
            >
              <Text style={styles.completeBtnText}>
                {isDone ? "إعادة فتح المرحلة" : "تحديد كمكتمل ✓"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.photosCard}>
            <PhotoGallery
              entityType="ORDER_STEP"
              entityId={currentStep.id}
              label={`صور ${STEP_LABELS[stepType]}`}
            />
          </View>
        </>
      ) : null}

      {pendingFromPrevious.length > 0 ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            تنبيه: عناصر متبقية من مراحل سابقة ({pendingFromPrevious.length})
          </Text>
          {pendingFromPrevious.map((msg, i) => (
            <Text key={i} style={styles.warningItem}>
              • {msg}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  completeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  warningCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
    gap: 4,
  },
  warningTitle: { fontSize: 13, fontWeight: "700", color: "#92400e" },
  warningItem: { fontSize: 12, color: "#78350f" },
  photosCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
});
