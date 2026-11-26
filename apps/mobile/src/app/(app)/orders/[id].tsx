import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { OrderDetail, OrderStep, OrderStepType } from "@/lib/api";
import {
  getStepRoute,
  STATUS_COLORS,
  STATUS_LABELS,
  STEP_LABELS,
} from "@/lib/step-labels";
import { ApiError, apiFetch } from "@/lib/api-client";

const ROW_HEIGHT = 64; // 56px card + 8px paddingBottom
const AUTO_SCROLL_EDGE = 130;
const AUTO_SCROLL_STEP = 10;

interface DraggableStepRowProps {
  step: OrderStep;
  index: number;
  activeIdx: SharedValue<number>;
  targetIdx: SharedValue<number>;
  dragY: SharedValue<number>;
  isBeingDragged: boolean;
  onPress: () => void;
  onDragStart: (index: number) => void;
  onDragMove: (index: number, translationY: number, absoluteY: number) => void;
  onDragEnd: () => void;
}

function DraggableStepRow({
  step,
  index,
  activeIdx,
  targetIdx,
  dragY,
  isBeingDragged,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
}: DraggableStepRowProps) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          onDragStart(index);
        })
        .onUpdate((e) => {
          onDragMove(index, e.translationY, e.absoluteY);
        })
        .onFinalize(() => {
          onDragEnd();
        }),
    [index, onDragStart, onDragMove, onDragEnd],
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (activeIdx.value === -1) {
      return {
        transform: [{ translateY: 0 }, { scale: 1 }],
        zIndex: 1,
        elevation: 0,
      };
    }

    if (activeIdx.value === index) {
      return {
        transform: [{ translateY: dragY.value }, { scale: 1.03 }],
        zIndex: 100,
        elevation: 8,
      };
    }

    let offset = 0;
    if (activeIdx.value < index && index <= targetIdx.value) {
      offset = -ROW_HEIGHT;
    } else if (targetIdx.value <= index && index < activeIdx.value) {
      offset = ROW_HEIGHT;
    }

    return {
      transform: [
        { translateY: withTiming(offset, { duration: 150 }) },
        { scale: 1 },
      ],
      zIndex: 1,
      elevation: 0,
    };
  });

  return (
    <Animated.View style={[styles.rowWrapper, animatedStyle]}>
      <Pressable
        style={[styles.stepRow, isBeingDragged && styles.stepRowActive]}
        onPress={onPress}
        disabled={isBeingDragged}
      >
        <GestureDetector gesture={pan}>
          <View
            style={[
              styles.dragHandle,
              isBeingDragged && styles.dragHandleActive,
            ]}
          >
            <Text style={styles.dragIcon}>☰</Text>
          </View>
        </GestureDetector>

        <View style={{ flex: 1 }}>
          <Text style={styles.stepName} numberOfLines={1}>
            {index + 1}. {STEP_LABELS[step.type]}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[step.status] },
          ]}
        >
          <Text style={styles.statusText}>{STATUS_LABELS[step.status]}</Text>
        </View>

        <Text style={styles.chevron}>‹</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const [localSteps, setLocalSteps] = useState<OrderStep[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const activeIdx = useSharedValue(-1);
  const targetIdx = useSharedValue(-1);
  const dragY = useSharedValue(0);

  // Scroll & auto-scroll refs
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const lastTranslationYRef = useRef(0);
  const activeDragIndexRef = useRef(-1);
  const scrollDirRef = useRef<-1 | 0 | 1>(0);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (order?.steps && !isDirty) {
      setLocalSteps(order.steps);
    }
  }, [order?.steps, isDirty]);

  useLayoutEffect(() => {
    activeIdx.value = -1;
    targetIdx.value = -1;
    dragY.value = 0;
  }, [localSteps, activeIdx, targetIdx, dragY]);

  const stopAutoScroll = useCallback(() => {
    scrollDirRef.current = 0;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const updateDragPosition = useCallback(
    (index: number, translationY: number) => {
      const scrollDelta = scrollOffsetRef.current - dragStartScrollRef.current;
      const effectiveY = translationY + scrollDelta;
      dragY.value = effectiveY;

      const maxIdx = Math.max(0, localSteps.length - 1);
      const next = Math.max(
        0,
        Math.min(maxIdx, Math.round(index + effectiveY / ROW_HEIGHT)),
      );
      targetIdx.value = next;
    },
    [localSteps.length, dragY, targetIdx],
  );

  const startAutoScroll = useCallback(
    (dir: -1 | 1) => {
      if (scrollDirRef.current === dir && autoScrollTimerRef.current) return;
      stopAutoScroll();
      scrollDirRef.current = dir;

      autoScrollTimerRef.current = setInterval(() => {
        const maxScroll = Math.max(
          0,
          contentHeightRef.current - viewportHeightRef.current,
        );
        const nextOffset = Math.max(
          0,
          Math.min(maxScroll, scrollOffsetRef.current + dir * AUTO_SCROLL_STEP),
        );
        if (nextOffset === scrollOffsetRef.current) return;

        scrollOffsetRef.current = nextOffset;
        scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
        if (activeDragIndexRef.current !== -1) {
          updateDragPosition(
            activeDragIndexRef.current,
            lastTranslationYRef.current,
          );
        }
      }, 16);
    },
    [stopAutoScroll, updateDragPosition],
  );

  const handleDragStart = useCallback(
    (index: number) => {
      activeDragIndexRef.current = index;
      dragStartScrollRef.current = scrollOffsetRef.current;
      lastTranslationYRef.current = 0;
      activeIdx.value = index;
      targetIdx.value = index;
      dragY.value = 0;
      setDraggingIndex(index);
    },
    [activeIdx, targetIdx, dragY],
  );

  const handleDragMove = useCallback(
    (index: number, translationY: number, absoluteY: number) => {
      lastTranslationYRef.current = translationY;
      updateDragPosition(index, translationY);

      const screenHeight = Dimensions.get("window").height;
      const topThreshold = insets.top + AUTO_SCROLL_EDGE;
      const bottomThreshold = screenHeight - insets.bottom - AUTO_SCROLL_EDGE;

      if (absoluteY < topThreshold) {
        startAutoScroll(-1);
      } else if (absoluteY > bottomThreshold) {
        startAutoScroll(1);
      } else {
        stopAutoScroll();
      }
    },
    [
      insets.top,
      insets.bottom,
      updateDragPosition,
      startAutoScroll,
      stopAutoScroll,
    ],
  );

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();
    const from = activeIdx.value;
    const to = targetIdx.value;
    activeDragIndexRef.current = -1;
    setDraggingIndex(null);

    if (from < 0 || to < 0 || from === to) {
      activeIdx.value = -1;
      targetIdx.value = -1;
      dragY.value = 0;
      return;
    }

    // Hold card in target slot until React commits the new order
    dragY.value = (to - from) * ROW_HEIGHT;

    setLocalSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      if (order) {
        const originalOrder = order.steps.map((s) => s.type).join(",");
        const nextOrder = next.map((s) => s.type).join(",");
        setIsDirty(originalOrder !== nextOrder);
      }
      return next;
    });
  }, [stopAutoScroll, activeIdx, targetIdx, dragY, order]);

  const reorderSteps = useMutation({
    mutationFn: (newOrder: OrderStepType[]) =>
      apiFetch(`/orders/${id}/steps/reorder`, {
        method: "PATCH",
        body: { order: newOrder },
      }),
    onSuccess: (_data, newOrder) => {
      qc.setQueryData<OrderDetail>(["order", id], (old) =>
        old
          ? {
              ...old,
              steps: newOrder
                .map((type) => old.steps.find((s) => s.type === type))
                .filter((s): s is OrderStep => Boolean(s)),
            }
          : old,
      );
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["order", id] });
      Alert.alert("تم الحفظ", "تم تأكيد الترتيب الجديد للمراحل");
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر حفظ الترتيب",
      );
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  if (isError || !order) {
    return (
      <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
        <Text style={{ color: "#dc2626" }}>
          {error instanceof ApiError ? error.message : "تعذر تحميل الطلب"}
        </Text>
        <Pressable style={styles.confirmBtn} onPress={() => refetch()}>
          <Text style={styles.btnText}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={draggingIndex === null}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          viewportHeightRef.current = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h;
        }}
      >
        <View style={styles.headerCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Pressable
              style={styles.financeBtn}
              onPress={() => router.push(`/(app)/orders/${order.id}/finance`)}
            >
              <Text style={styles.financeBtnText}>المالية والأرباح</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{order.title || "بدون عنوان"}</Text>
          <Text style={styles.meta}>الزبون: {order.customer.name}</Text>
          {order.note ? <Text style={styles.note}>{order.note}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>
          مراحل الطلب (اضغط لفتح المرحلة أو اسحب ☰ لإعادة الترتيب)
        </Text>

        <View>
          {localSteps.map((step, index) => (
            <DraggableStepRow
              key={step.id}
              step={step}
              index={index}
              activeIdx={activeIdx}
              targetIdx={targetIdx}
              dragY={dragY}
              isBeingDragged={draggingIndex === index}
              onPress={() =>
                router.push(getStepRoute(order.id, step.type) as any)
              }
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            />
          ))}
        </View>
      </ScrollView>

      {isDirty ? (
        <View
          style={[
            styles.confirmBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            style={styles.cancelBtn}
            disabled={reorderSteps.isPending}
            onPress={() => {
              setLocalSteps(order.steps);
              setIsDirty(false);
            }}
          >
            <Text style={styles.cancelText}>إلغاء</Text>
          </Pressable>

          <Pressable
            style={[
              styles.confirmBtn,
              reorderSteps.isPending && { opacity: 0.6 },
            ]}
            disabled={reorderSteps.isPending}
            onPress={() => reorderSteps.mutate(localSteps.map((s) => s.type))}
          >
            <Text style={styles.btnText}>
              {reorderSteps.isPending
                ? "جاري الحفظ..."
                : "تأكيد الترتيب الجديد"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  headerCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  financeBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  financeBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  title: { fontSize: 18, fontWeight: "700" },
  meta: { fontSize: 14, color: "#4b5563" },
  note: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },
  rowWrapper: {
    height: ROW_HEIGHT,
    paddingBottom: 8,
  },
  stepRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  stepRowActive: {
    borderColor: "#2563eb",
    borderWidth: 2,
    backgroundColor: "#eff6ff",
  },
  dragHandle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  dragHandleActive: {
    backgroundColor: "#dbeafe",
  },
  dragIcon: { fontSize: 18, color: "#374151" },
  stepName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  chevron: { fontSize: 20, color: "#9ca3af", fontWeight: "700" },
  confirmBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  cancelText: { color: "#374151", fontWeight: "700" },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
