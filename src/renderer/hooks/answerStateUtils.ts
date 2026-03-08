export function isStaleAnswerRequest(
  incomingRequestId: number,
  activeRequestId: number
): boolean {
  return incomingRequestId < activeRequestId;
}
