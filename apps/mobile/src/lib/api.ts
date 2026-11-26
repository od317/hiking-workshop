export type OrderStepType =
  | "PATTERN"
  | "SAMPLE"
  | "ACCESSORIES"
  | "CLOTH"
  | "CUTTING"
  | "WORKSHOP"
  | "FINISHING"
  | "FINAL_CHECK"
  | "DELIVERY";

export type OrderStepStatus =
  "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "SKIPPED";

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
}

export interface OrderStep {
  id: string;
  orderId: string;
  type: OrderStepType;
  status: OrderStepStatus;
  sortOrder: number;
  note?: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  title?: string | null;
  note?: string | null;
  createdAt: string;
  customer: Pick<Customer, "id" | "name" | "phone">;
  steps: OrderStep[];
}

export interface OrderDetail extends OrderSummary {
  customer: Customer;
  patterns: Array<{
    id: string;
    versionNum: number;
    note?: string | null;
    createdAt: string;
  }>;
  samples: Array<{
    id: string;
    attemptNum: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    note?: string | null;
    decisionNote?: string | null;
    createdAt: string;
  }>;
}

export type MaterialKind = "FABRIC" | "ACCESSORY";

export interface Material {
  id: string;
  kind: MaterialKind;
  name: string;
  color?: string | null;
  unit: string;
  unitCostMinor?: number | null;
  note?: string | null;
  currentStock: number;
}

export interface OrderMaterial {
  id: string;
  orderId: string;
  kind: MaterialKind;
  materialId?: string | null;
  material?: Pick<Material, "id" | "name" | "color" | "unit"> | null;
  customName?: string | null;
  customColor?: string | null;
  quantity: string | number;
  unit: string;
  note?: string | null;
}

export interface ProductionLine {
  id: string;
  orderId: string;
  color: string;
  size: string;
  orderedQty: number;
  cutQty: number;
  remainingToCut: number;
  openHoldQty: number;
}

export interface ProductionHold {
  id: string;
  orderId: string;
  orderLineId: string;
  stage: OrderStepType;
  quantity: number;
  reason: string;
  status: "OPEN" | "RESOLVED";
  orderLine: { color: string; size: string };
  createdAt: string;
}

export interface ProductionBoard {
  orderId: string;
  orderNumber: string;
  totals: {
    orderedQty: number;
    cutQty: number;
    openHoldQty: number;
  };
  lines: ProductionLine[];
  openHolds: ProductionHold[];
}
