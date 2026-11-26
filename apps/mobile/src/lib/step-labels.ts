import { OrderStepStatus, OrderStepType } from "@/lib/api";
export const STEP_LABELS: Record<OrderStepType, string> = {
  PATTERN: "الباترون",
  SAMPLE: "العينة",
  ACCESSORIES: "الإكسسوارات",
  CLOTH: "القماش",
  CUTTING: "القص",
  WORKSHOP: "المشغل",
  FINISHING: "الكوي والإكسسوار",
  FINAL_CHECK: "الفحص النهائي",
  DELIVERY: "التسليم والمرتجع",
};

export const STATUS_LABELS: Record<OrderStepStatus, string> = {
  NOT_STARTED: "لم يبدأ",
  IN_PROGRESS: "قيد العمل",
  DONE: "مكتمل",
  BLOCKED: "متوقف",
  SKIPPED: "متجاوز",
};

export const STATUS_COLORS: Record<OrderStepStatus, string> = {
  NOT_STARTED: "#9ca3af",
  IN_PROGRESS: "#2563eb",
  DONE: "#16a34a",
  BLOCKED: "#dc2626",
  SKIPPED: "#6b7280",
};

export function getStepRoute(orderId: string, stepType: OrderStepType): string {
  switch (stepType) {
    case "PATTERN":
      return `/(app)/orders/${orderId}/pattern`;
    case "SAMPLE":
      return `/(app)/orders/${orderId}/sample`;
    case "ACCESSORIES":
      return `/(app)/orders/${orderId}/accessories`;
    case "CLOTH":
      return `/(app)/orders/${orderId}/cloth`;
    case "CUTTING":
      return `/(app)/orders/${orderId}/production?step=${stepType}`;
    case "WORKSHOP":
      return `/(app)/orders/${orderId}/workshops?step=${stepType}`;
    case "FINISHING":
    case "FINAL_CHECK":
    case "DELIVERY":
      return `/(app)/orders/${orderId}/delivery?step=${stepType}`;
  }
}
