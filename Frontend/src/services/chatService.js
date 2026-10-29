import api from "./api";

/**
 * Send a chat message to AgroLens Assistant.
 * @param {Object} params
 * @param {string} params.message - User message (1–1000 chars)
 * @param {string} [params.conversationId] - Optional existing conversation ID
 * @param {string} [params.diagnosisId] - Optional diagnosis ID for context
 * @param {"en"|"si"} [params.language="en"] - Language preference
 */
export async function sendChatMessage({
  message,
  conversationId = null,
  diagnosisId = null,
  language = "en",
}) {
  const payload = {
    message,
    language: language === "si" ? "si" : "en",
  };
  if (conversationId) payload.conversation_id = conversationId;
  if (diagnosisId) payload.diagnosis_id = diagnosisId;

  const response = await api.post("/api/chat", payload);
  return response.data;
}

/**
 * List all conversations for the current user (newest first).
 */
export async function getConversations() {
  const response = await api.get("/api/chat/conversations");
  return response.data;
}

/**
 * Get a single conversation with all messages.
 * @param {string} conversationId
 */
export async function getConversationById(conversationId) {
  const response = await api.get(`/api/chat/conversations/${conversationId}`);
  return response.data;
}

/**
 * Delete a conversation by ID.
 * @param {string} conversationId
 */
export async function deleteConversation(conversationId) {
  const response = await api.delete(`/api/chat/conversations/${conversationId}`);
  return response.data;
}
