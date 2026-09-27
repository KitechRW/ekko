export type Platform = "web" | "android" | "ios" | "android_tv";

export type LiveSessionStatus =
  | "scheduled"
  | "live"
  | "offline"
  | "ended";

export type ReactionType =
  | "love"
  | "amen"
  | "praise"
  | "fire"
  | "moved"
  | "peace";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  logoUrl?: string;
}

export interface StreamSource {
  id: string;
  organizationId: string;
  type: "hls";
  url: string;
  enabled: boolean;
}

export interface Program {
  id: string;
  organizationId: string;
  title: string;
  subtitle?: string;
  speaker?: string;
  description?: string;
  artworkUrl?: string;
}

export interface LiveSession {
  id: string;
  organizationId: string;
  programId?: string;
  streamSourceId: string;
  status: LiveSessionStatus;
  scheduledStartAt?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface ViewerPresence {
  liveSessionId: string;
  viewerId: string;
  platform: Platform;
  connectedAt: string;
  lastSeenAt: string;
}

export interface ChatMessage {
  id: string;
  organizationId: string;
  liveSessionId: string;
  userId?: string;
  displayName: string;
  message: string;
  createdAt: string;
}

export interface ReactionBatch {
  organizationId: string;
  liveSessionId: string;
  viewerId: string;
  type: ReactionType;
  count: number;
}

export interface ReactionStats {
  total: number;
  byType: Record<ReactionType, number>;
}

export interface ProgramInfo {
  title: string;
  subtitle?: string;
  speaker?: string;
  description?: string;
  artworkUrl?: string;
}
