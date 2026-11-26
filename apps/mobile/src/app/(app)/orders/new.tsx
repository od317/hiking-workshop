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
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Customer, OrderDetail } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

export default function NewOrderScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });

  const createCustomer = useMutation({
    mutationFn: () =>
      apiFetch<Customer>("/customers", {
        method: "POST",
        body: {
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
        },
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(created.id);
      setNewCustomerName("");
      setNewCustomerPhone("");
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر إضافة الزبون",
      );
    },
  });

  const createOrder = useMutation({
    mutationFn: () =>
      apiFetch<OrderDetail>("/orders", {
        method: "POST",
        body: {
          customerId,
          title: title.trim() || undefined,
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      router.replace(`/(app)/orders/${order.id}`);
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر إنشاء الطلب",
      );
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>1. اختر الزبون</Text>
      <View style={styles.chipWrap}>
        {(customers ?? []).map((c) => {
          const selected = c.id === customerId;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setCustomerId(c.id)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.subLabel}>أو أضف زبون جديد سريعاً:</Text>
      <View style={styles.inlineRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="اسم الزبون"
          value={newCustomerName}
          onChangeText={setNewCustomerName}
          textAlign="right"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="الهاتف (اختياري)"
          value={newCustomerPhone}
          onChangeText={setNewCustomerPhone}
          keyboardType="phone-pad"
          textAlign="right"
        />
        <Pressable
          style={styles.smallBtn}
          disabled={!newCustomerName.trim() || createCustomer.isPending}
          onPress={() => createCustomer.mutate()}
        >
          <Text style={styles.smallBtnText}>إضافة</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>2. تفاصيل الطلب</Text>
      <TextInput
        style={styles.input}
        placeholder="عنوان الموديل (مثال: قميص أبيض صيفي)"
        value={title}
        onChangeText={setTitle}
        textAlign="right"
      />
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        placeholder="ملاحظات الزبون..."
        multiline
        value={note}
        onChangeText={setNote}
        textAlign="right"
      />

      <Pressable
        style={[
          styles.submitBtn,
          (!customerId || createOrder.isPending) && { opacity: 0.5 },
        ]}
        disabled={!customerId || createOrder.isPending}
        onPress={() => createOrder.mutate()}
      >
        {createOrder.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>إنشاء الطلب</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: "#fff", flexGrow: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  subLabel: { fontSize: 13, color: "#4b5563" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { color: "#111827" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  inlineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  smallBtnText: { color: "#fff", fontWeight: "600" },
  submitBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
