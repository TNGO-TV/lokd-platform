export type ProviderCapability = "backend" | "identity" | "payments" | "payroll" | "messaging" | "maps" | "evidence";

export type ProviderOperationState =
  | "pending"
  | "dispatching"
  | "provider_accepted"
  | "awaiting_webhook"
  | "succeeded"
  | "retryable_failed"
  | "terminal_failed"
  | "cancelled";

export type IdentityCaseState =
  | "created"
  | "consent_pending"
  | "submitted"
  | "processing"
  | "verified"
  | "rejected"
  | "manual_review"
  | "expired"
  | "cancelled";

export type PaymentOrderState =
  | "created"
  | "requires_action"
  | "pending"
  | "authorised"
  | "captured"
  | "cleared"
  | "reconciled"
  | "failed"
  | "cancelled"
  | "refunded"
  | "disputed";

export type ProviderHealth = {
  state: "healthy" | "degraded" | "unavailable" | "not_configured";
  checkedAt: string;
  detail: string;
};

export type ProviderResult<T> = {
  providerReference: string;
  status: string;
  value: T;
};

export interface IdentityProvider {
  readonly key: string;
  createSession(input: { caseId: string; callbackReference: string }): Promise<ProviderResult<{ redirectUrl: string }>>;
  health(): Promise<ProviderHealth>;
}

export interface PaymentProvider {
  readonly key: string;
  createPayment(input: { orderId: string; amountCents: number; currency: "ZAR"; callbackReference: string }): Promise<ProviderResult<{ redirectUrl: string }>>;
  health(): Promise<ProviderHealth>;
}

export interface PayrollProvider {
  readonly key: string;
  submitBatch(input: { runId: string; exportReference: string }): Promise<ProviderResult<{ acceptedItems: number }>>;
  health(): Promise<ProviderHealth>;
}

export interface MessagingProvider {
  readonly key: string;
  send(input: { messageId: string; channel: "sms" | "whatsapp" | "email"; template: string }): Promise<ProviderResult<{ deliveryState: string }>>;
  health(): Promise<ProviderHealth>;
}

export interface MapsProvider {
  readonly key: string;
  assessTravel(input: { assessmentId: string; origin: string; destination: string }): Promise<ProviderResult<{ estimatedMinutes: number }>>;
  health(): Promise<ProviderHealth>;
}

export interface EvidenceStore {
  readonly key: string;
  reserve(input: { artifactId: string; mimeType: string; sizeBytes: number; contentHash: string }): Promise<ProviderResult<{ uploadReference: string }>>;
  health(): Promise<ProviderHealth>;
}

export class DisabledProvider {
  readonly key: string;
  readonly capability: ProviderCapability;

  constructor(key: string, capability: ProviderCapability) {
    this.key = key;
    this.capability = capability;
  }

  async health(): Promise<ProviderHealth> {
    return {
      state: "not_configured",
      checkedAt: new Date().toISOString(),
      detail: `${this.capability} provider credentials and production endpoint are not configured.`,
    };
  }
}

export const identityTransitions: Record<IdentityCaseState, IdentityCaseState[]> = {
  created: ["consent_pending", "submitted", "cancelled"],
  consent_pending: ["submitted", "cancelled", "expired"],
  submitted: ["processing", "manual_review", "cancelled", "expired"],
  processing: ["verified", "rejected", "manual_review", "expired"],
  verified: [],
  rejected: ["manual_review"],
  manual_review: ["verified", "rejected", "cancelled", "expired"],
  expired: [],
  cancelled: [],
};

export const paymentTransitions: Record<PaymentOrderState, PaymentOrderState[]> = {
  created: ["requires_action", "pending", "cancelled"],
  requires_action: ["pending", "cancelled", "failed"],
  pending: ["authorised", "failed", "cancelled"],
  authorised: ["captured", "cancelled", "failed"],
  captured: ["cleared", "refunded", "disputed"],
  cleared: ["reconciled", "refunded", "disputed"],
  reconciled: ["refunded", "disputed"],
  failed: [],
  cancelled: [],
  refunded: [],
  disputed: [],
};

export function assertTransition<T extends string>(current: T, next: T, transitions: Record<T, T[]>) {
  if (!transitions[current]?.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}.`);
}
