export const normalizeStatus = (prevStatus: string, nextStatus: string) => {
  if (nextStatus === "speaking" && prevStatus === "thinking") return prevStatus;
  return nextStatus;
};

export const isSpeakingStatus = (status: string) => {
  return status === "speaking";
};

export const isSilentStatus = (status: string) => {
  return status === "listening" || status === "interrupted" || status === "thinking";
};
