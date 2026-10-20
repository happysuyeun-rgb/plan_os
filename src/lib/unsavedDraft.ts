/** Local backup of text not yet saved to the server. */
export const unsavedDraftKey = (userId: string, documentId: string) =>
  `planos:draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(documentId)}`
