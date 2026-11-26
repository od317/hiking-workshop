import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OrderStepType } from "@/lib/api";
import { STEP_LABELS } from "@/lib/step-labels";
import { ApiError, apiFetch } from "@/lib/api-client";

export function StepNote({
  orderId,
  stepType,
  initial,
}: {
  orderId: string;
  stepType: OrderStepType;
  initial?: string | null;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(initial ?? "");
  const [base, setBase] = useState(initial ?? "");

  // Pick up server changes, but never overwrite what the user is typing
  useEffect(() => {
    const next = initial ?? "";
    if (next !== base) {
      if (text === base) setText(next);
      setBase(next);
    }
  }, [initial]);

  const dirty = text.trim() !== base.trim();

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${orderId}/steps/${stepType}/note`, {
        method: "PATCH",
        body: { note: text.trim() },
      }),
    onSuccess: () => {
      setText(text.trim());
      setBase(text.trim());
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err) =>
      Alert.alert(
        "تعذر حفظ الملاحظة",
        err instanceof ApiError ? err.message : "حدث خطأ",
      ),
  });

  return (
    <View style={styles.card}>
      <Text style={styles.label}>ملاحظات {STEP_LABELS[stepType]}</Text>
      <TextInput
        style={styles.input}
        placeholder="اكتب ملاحظاتك على هذه المرحلة..."
        value={text}
        onChangeText={setText}
        multiline
        textAlign="right"
        textAlignVertical="top"
      />
      {dirty ? (
        <Pressable
          style={[styles.btn, save.isPending && { opacity: 0.6 }]}
          disabled={save.isPending}
          onPress={() => save.mutate()}
        >
          <Text style={styles.btnText}>
            {save.isPending ? "جاري الحفظ..." : "حفظ الملاحظة"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  label: { fontSize: 13, fontWeight: "700", color: "#4b5563" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 70,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
