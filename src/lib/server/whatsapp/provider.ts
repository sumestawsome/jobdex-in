import "server-only";

export type WhatsAppProviderName = "wablas" | "fonnte";

export type WhatsAppSendTarget = {
  target: string;
  type?: "phone" | "group";
  label?: string;
};

export type WhatsAppSendPayload = {
  target: string;
  message: string;
  type?: "phone" | "group";
  previewUrl?: boolean;
  mentions?: string[];
  org_id?: string;
  orgId?: string;
};

export type WhatsAppSendResult = {
  ok: boolean;
  provider: WhatsAppProviderName;
  target: string;
  responseText?: string;
  response?: unknown;
  error?: string;
  skipped?: boolean;
  notConfigured?: boolean;
};

