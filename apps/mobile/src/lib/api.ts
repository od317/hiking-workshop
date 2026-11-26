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

export interface Workshop {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  balanceMinor: number;
}

export interface WorkshopBatch {
  id: string;
  orderId: string;
  orderLineId: string;
  workshopId: string;
  sentQty: number;
  receivedQty: number;
  remainingQty: number;
  ratePerPieceMinor: number;
  note?: string | null;
  workshop: { id: string; name: string };
  orderLine: { id: string; color: string; size: string };
}

export interface FulfillmentLine {
  id: string;
  color: string;
  size: string;
  orderedQty: number;
  finishedQty: number;
  qcPassedQty: number;
  qcRejectedQty: number;
  readyToDeliverQty: number;
  deliveredQty: number;
  returnedQty: number;
}

export interface FulfillmentSummary {
  orderId: string;
  lines: FulfillmentLine[];
}

export interface OrderInvoice {
  id: string;
  totalMinor: number;
  status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  note?: string | null;
  payments: Array<{
    id: string;
    amountMinor: number;
    method?: string | null;
    note?: string | null;
    createdAt: string;
  }>;
}

export interface OrderFinance {
  orderId: string;
  orderNumber: string;
  revenue: {
    totalInvoicedMinor: number;
    totalPaidMinor: number;
    customerBalanceDueMinor: number;
  };
  costs: {
    materialCostMinor: number;
    workshopCostMinor: number;
    otherExpensesMinor: number;
    totalCostMinor: number;
  };
  profitMinor: number;
  invoices: OrderInvoice[];
  expenses: Array<{
    id: string;
    category: string;
    amountMinor: number;
    note?: string | null;
    createdAt: string;
  }>;
}


