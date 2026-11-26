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

import { OrderFinance } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

export default function OrderFinanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["order-finance", id],
    queryFn: () => apiFetch<OrderFinance>(`/orders/${id}/finance`),
    enabled: Boolean(id),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["order-finance", id] });

  const createInvoice = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/invoices`, {
        method: "POST",
        body: { totalMinor: Number(invoiceTotal) },
      }),
    onSuccess: () => {
      setInvoiceTotal("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر الإنشاء",
      );
    },
  });

  const recordPayment = useMutation({
    mutationFn: (vars: { invoiceId: string; amountMinor: number }) =>
      apiFetch(`/invoices/${vars.invoiceId}/payments`, {
        method: "POST",
        body: { amountMinor: vars.amountMinor, method: "cash" },
      }),
    onSuccess: () => {
      setPayingInvoiceId(null);
      setPaymentAmount("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert("خطأ", err instanceof ApiError ? err.message : "تعذر الدفع");
    },
  });

  const createExpense = useMutation({
    mutationFn: () =>
      apiFetch("/expenses", {
        method: "POST",
        body: {
          orderId: id,
          category: expenseCategory.trim(),
          amountMinor: Number(expenseAmount),
        },
      }),
    onSuccess: () => {
      setExpenseCategory("");
      setExpenseAmount("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر الإضافة",
      );
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  if (isError || !data) {
    return (
      <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
        <Text style={{ color: "#dc2626" }}>
          {error instanceof ApiError ? error.message : "تعذر التحميل"}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => refetch()}>
          <Text style={[styles.btnText, { paddingHorizontal: 16 }]}>
            إعادة المحاولة
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* SUMMARY */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ملخص الربح ({data.orderNumber})</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>إجمالي الفواتير</Text>
          <Text style={styles.val}>
            {data.revenue.totalInvoicedMinor.toLocaleString()}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>المدفوع من الزبون</Text>
          <Text style={[styles.val, { color: "#16a34a" }]}>
            {data.revenue.totalPaidMinor.toLocaleString()}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>المتبقي على الزبون</Text>
          <Text style={[styles.val, { color: "#d97706" }]}>
            {data.revenue.customerBalanceDueMinor.toLocaleString()}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>تكلفة المواد</Text>
          <Text style={styles.val}>
            {data.costs.materialCostMinor.toLocaleString()}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>أجور المشاغل</Text>
          <Text style={styles.val}>
            {data.costs.workshopCostMinor.toLocaleString()}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>مصاريف أخرى</Text>
          <Text style={styles.val}>
            {data.costs.otherExpensesMinor.toLocaleString()}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>صافي الربح</Text>
          <Text
            style={[
              styles.sectionTitle,
              { color: data.profitMinor >= 0 ? "#16a34a" : "#dc2626" },
            ]}
          >
            {data.profitMinor.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* INVOICES */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          الفواتير ({data.invoices.length})
        </Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="قيمة الفاتورة الجديدة"
            value={invoiceTotal}
            onChangeText={setInvoiceTotal}
            keyboardType="numeric"
            textAlign="right"
          />
          <Pressable
            style={styles.confirmBtn}
            disabled={!Number(invoiceTotal) || createInvoice.isPending}
            onPress={() => createInvoice.mutate()}
          >
            <Text style={styles.btnText}>+ فاتورة</Text>
          </Pressable>
        </View>

        {data.invoices.map((inv) => {
          const paid = inv.payments.reduce((s, p) => s + p.amountMinor, 0);
          const remaining = inv.totalMinor - paid;
          const isPaying = payingInvoiceId === inv.id;

          return (
            <View key={inv.id} style={styles.subCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.val}>
                  {inv.totalMinor.toLocaleString()} ({inv.status})
                </Text>
                <Text style={styles.meta}>
                  متبقي: {remaining.toLocaleString()}
                </Text>
              </View>
              {remaining > 0 ? (
                <>
                  <Pressable
                    onPress={() => {
                      setPaymentAmount("");
                      setPayingInvoiceId(isPaying ? null : inv.id);
                    }}
                  >
                    <Text style={styles.linkText}>
                      {isPaying ? "إلغاء" : "+ تسجيل دفعة من الزبون"}
                    </Text>
                  </Pressable>
                  {isPaying ? (
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="المبلغ"
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="numeric"
                        textAlign="right"
                      />
                      <Pressable
                        style={[
                          styles.confirmBtn,
                          { backgroundColor: "#16a34a" },
                        ]}
                        disabled={
                          !Number(paymentAmount) || recordPayment.isPending
                        }
                        onPress={() =>
                          recordPayment.mutate({
                            invoiceId: inv.id,
                            amountMinor: Number(paymentAmount),
                          })
                        }
                      >
                        <Text style={styles.btnText}>حفظ</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* EXPENSES */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>مصاريف إضافية</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="البند (نقل/تغليف)"
            value={expenseCategory}
            onChangeText={setExpenseCategory}
            textAlign="right"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="المبلغ"
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            keyboardType="numeric"
            textAlign="right"
          />
        </View>
        <Pressable
          style={[
            styles.primaryBtn,
            (!expenseCategory.trim() ||
              !Number(expenseAmount) ||
              createExpense.isPending) && { opacity: 0.5 },
          ]}
          disabled={
            !expenseCategory.trim() ||
            !Number(expenseAmount) ||
            createExpense.isPending
          }
          onPress={() => createExpense.mutate()}
        >
          <Text style={styles.btnText}>إضافة مصروف</Text>
        </Pressable>
      </View>
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
  subCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { fontSize: 13, color: "#4b5563" },
  val: { fontSize: 14, fontWeight: "700", color: "#111827" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 2 },
  linkText: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
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
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
