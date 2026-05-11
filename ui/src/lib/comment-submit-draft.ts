export function restoreОтправитьtedCommentЧерновик(params: {
  currentBody: string;
  submittedBody: string;
}) {
  return params.currentBody.trim() ? params.currentBody : params.submittedBody;
}
