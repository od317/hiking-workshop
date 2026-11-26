import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { StepHeader } from "@/components/step-header";
import { OrderMaterialsSection } from "@/components/order-materials-section";

export default function AccessoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepHeader orderId={id} stepType="ACCESSORIES" />
      <OrderMaterialsSection orderId={id} kind="ACCESSORY" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12, backgroundColor: "#f9fafb", flexGrow: 1 },
});
