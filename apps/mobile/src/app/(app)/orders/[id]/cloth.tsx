import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { StepHeader } from "@/components/step-header";
import { ClothMatrix } from "@/components/cloth-matrix";
import { OrderMaterialsSection } from "@/components/order-materials-section";

export default function ClothScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeader orderId={id} stepType="CLOTH" />
      <ClothMatrix orderId={id} />
      <OrderMaterialsSection orderId={id} kind="FABRIC" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 16, backgroundColor: "#f9fafb", flexGrow: 1 },
});
