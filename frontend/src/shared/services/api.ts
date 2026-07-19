export type {
  BackendHealthResponse,
  LivekitHealthResponse,
  LivekitTokenResponse,
} from "features/interview/services/livekitApi";

export type {
  ClaimCategory,
  ClaimStatus,
  DemonstrationStrength,
  PipelineStatus,
  PollSessionProfileClaimsResult,
  ProfileClaim,
  ProfileMemoryResponse,
  ProfileMemorySummaryV1,
  SessionProfileClaimsResponse,
} from "features/interview/services/profileClaimsApi";

export type {
  ReadinessRequest,
  ReadinessResponse,
  ReadinessSnapshot,
} from "features/interview/services/readinessApi";

export type {
  InterviewHistoryItem,
  InterviewHistoryResponse,
  PairProgrammingStartConfig,
  ReplayHighlight,
  ResumeStartConfig,
  RoleTargetedStartConfig,
  SessionDetailsResponse,
  StartInterviewConfig,
  StartInterviewParams,
  StartInterviewResponse,
  SubmitCodeResponse,
  TranscriptLine,
} from "features/interview/services/interviewApi";

import { accountApi } from "features/interview/services/accountApi";
import { interviewApi } from "features/interview/services/interviewApi";
import { livekitApi } from "features/interview/services/livekitApi";
import { profileClaimsApi } from "features/interview/services/profileClaimsApi";
import { readinessApi } from "features/interview/services/readinessApi";

/** @deprecated Prefer feature-specific APIs (interviewApi, livekitApi, profileClaimsApi, readinessApi, accountApi). */
export const api = {
  ...livekitApi,
  ...interviewApi,
  ...profileClaimsApi,
  ...readinessApi,
  ...accountApi,
};

export { interviewApi, livekitApi, profileClaimsApi, readinessApi, accountApi };
