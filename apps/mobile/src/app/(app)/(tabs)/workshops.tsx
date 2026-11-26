import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Workshop } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

export default function WorkshopsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["workshops"],
    queryFn: () => apiFetch<Workshop[]>("/workshops"),
  });

  const createWorkshop = useMutation({
    mutationFn: () =>
      apiFetch<Workshop>("/workshops", {
        method: "POST",
        body: { name: name.trim(), phone: phone.trim() || undefined },
      }),
    onSuccess: () => {
      setName("");
      setPhone("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["workshops"] });
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر الإضافة",
      );
    },
  });

  const recordPayment = useMutation({
    mutationFn: (vars: { id: string; amountMinor: number; note?: string }) =>
      apiFetch(`/workshops/${vars.id}/payments`, {
        method: "POST",
        body: { amountMinor: vars.amountMinor, note: vars.note },
      }),
    onSuccess: () => {
      setPayingId(null);
      setPayAmount("");
      setPayNote("");
      qc.invalidateQueries({ queryKey: ["workshops"] });
    },
    onError: (err) => {
      Alert.alert("خطأ", err instanceof ApiError ? err.message : "تعذر الدفع");
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.headerText}>المشاغل الخارجية</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.btnText}>{showForm ? "إغلاق" : "+ مشغل"}</Text>
        </Pressable>
      </View>

      {showForm ? (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="اسم المشغل"
            value={name}
            onChangeText={setName}
            textAlign="right"
          />
          <TextInput
            style={styles.input}
            placeholder="الهاتف (اختياري)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign="right"
          />
          <Pressable
            style={[
              styles.primaryBtn,
              (!name.trim() || createWorkshop.isPending) && { opacity: 0.5 },
            ]}
            disabled={!name.trim() || createWorkshop.isPending}
            onPress={() => createWorkshop.mutate()}
          >
            <Text style={styles.btnText}>حفظ المشغل</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>لا توجد مشاغل بعد</Text>
          }
          renderItem={({ item }) => {
            const isPaying = payingId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.title}>{item.name}</Text>
                    {item.phone ? (
                      <Text style={styles.meta}>{item.phone}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.balance}>
                      الرصيد: {item.balanceMinor.toLocaleString()}
                    </Text>
                    <Pressable
                      onPress={() => setPayingId(isPaying ? null : item.id)}
                    >
                      <Text style={styles.linkText}>
                        {isPaying ? "إلغاء" : "تسجيل دفعة"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {isPaying ? (
                  <View style={{ gap: 8 }}>
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="المبلغ"
                        value={payAmount}
                        onChangeText={setPayAmount}
                        keyboardType="numeric"
                        textAlign="right"
                      />
                      <TextInput
                        style={[styles.input, { flex: 2 }]}
                        placeholder="ملاحظة (اختياري)"
                        value={payNote}
                        onChangeText={setPayNote}
                        textAlign="right"
                      />
                    </View>
                    <Pressable
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: "#16a34a" },
                      ]}
                      disabled={!Number(payAmount) || recordPayment.isPending}
                      onPress={() =>
                        recordPayment.mutate({
                          id: item.id,
                          amountMinor: Number(payAmount),
                          note: payNote.trim() || undefined,
                        })
                      }
                    >
                      <Text style={styles.btnText}>تأكيد الدفعة</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 12 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerText: { fontSize: 16, fontWeight: "700" },
  addBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12, color: "#6b7280" },
  balance: { fontSize: 14, fontWeight: "700", color: "#dc2626" },
  linkText: { fontSize: 12, color: "#111827", textDecorationLine: "underline" },
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
  empty: { textAlign: "center", marginTop: 40, color: "#6b7280" },
});
