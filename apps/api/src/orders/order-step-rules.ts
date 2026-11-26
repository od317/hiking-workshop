import { OrderStepStatus, OrderStepType } from '@prisma/client';

export const ALL_ORDER_STEPS: OrderStepType[] = [
  OrderStepType.PATTERN,
  OrderStepType.SAMPLE,
  OrderStepType.ACCESSORIES,
  OrderStepType.CLOTH,
  OrderStepType.CUTTING,
  OrderStepType.WORKSHOP,
  OrderStepType.FINISHING,
  OrderStepType.FINAL_CHECK,
  OrderStepType.DELIVERY,
];

type Prerequisite = {
  step: OrderStepType;
  allowedStatuses: OrderStepStatus[];
};

// Enforced only when moving a step to IN_PROGRESS or DONE
export const STEP_DEPENDENCIES: Partial<Record<OrderStepType, Prerequisite[]>> =
  {
    SAMPLE: [
      {
        step: OrderStepType.PATTERN,
        allowedStatuses: [OrderStepStatus.IN_PROGRESS, OrderStepStatus.DONE],
      },
    ],
    CUTTING: [
      { step: OrderStepType.SAMPLE, allowedStatuses: [OrderStepStatus.DONE] },
      { step: OrderStepType.CLOTH, allowedStatuses: [OrderStepStatus.DONE] },
    ],
    WORKSHOP: [
      {
        step: OrderStepType.CUTTING,
        allowedStatuses: [OrderStepStatus.IN_PROGRESS, OrderStepStatus.DONE],
      },
    ],
    FINISHING: [
      {
        step: OrderStepType.WORKSHOP,
        allowedStatuses: [OrderStepStatus.IN_PROGRESS, OrderStepStatus.DONE],
      },
    ],
    FINAL_CHECK: [
      {
        step: OrderStepType.FINISHING,
        allowedStatuses: [OrderStepStatus.IN_PROGRESS, OrderStepStatus.DONE],
      },
    ],
    DELIVERY: [
      {
        step: OrderStepType.FINAL_CHECK,
        allowedStatuses: [OrderStepStatus.IN_PROGRESS, OrderStepStatus.DONE],
      },
    ],
  };

export function findUnmetDependencies(
  targetStep: OrderStepType,
  targetStatus: OrderStepStatus,
  currentSteps: Array<{ type: OrderStepType; status: OrderStepStatus }>,
): OrderStepType[] {
  if (
    targetStatus !== OrderStepStatus.IN_PROGRESS &&
    targetStatus !== OrderStepStatus.DONE
  ) {
    return [];
  }

  const reqs = STEP_DEPENDENCIES[targetStep] ?? [];
  const statusMap = new Map(currentSteps.map((s) => [s.type, s.status]));

  return reqs
    .filter((req) => {
      const current = statusMap.get(req.step);
      return !current || !req.allowedStatuses.includes(current);
    })
    .map((req) => req.step);
}
