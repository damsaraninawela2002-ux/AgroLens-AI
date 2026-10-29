import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Bot,
  MessageSquare,
  MessageSquarePlus,
  PanelLeft,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useLanguage } from "../../context/LanguageContext";
import {
  deleteConversation,
  getConversationById,
  getConversations,
  sendChatMessage,
} from "../../services/chatService";
import { getDiagnosisById } from "../../services/predictService";
import {
  extractErrorMessage,
  formatDiseaseKey,
  formatTimeAgo,
  getImageUrl,
} from "../../utils/formatters";

const MAX_MESSAGE_LENGTH = 1000;

const SUGGESTED_QUESTIONS = {
  en: [
    "Why do my leaves turn yellow?",
    "How can I prevent leaf diseases?",
    "When should I water tomatoes?",
    "What should I do after a disease is found?",
  ],
  si: [
    "කොළ කහ පාට වෙන්නේ ඇයි?",
    "කොළ රෝග වළක්වන්නේ කොහොමද?",
    "තක්කාලිවලට වතුර දාන්න හොඳ වෙලාව?",
    "රෝගයක් හමු වුණාම කළ යුත්තේ මොනවාද?",
  ],
};

function formatMessageTime(dateInput, lang = "en") {
  if (!dateInput) return "";
  try {
    const raw =
      typeof dateInput === "string" &&
      !dateInput.endsWith("Z") &&
      !dateInput.includes("+")
        ? `${dateInput}Z`
        : dateInput;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    const locale = lang === "si" ? "si-LK" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

export default function AIAssistant() {
  const { lang, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDiagnosisId =
    searchParams.get("diagnosis") ||
    searchParams.get("diagnosis_id") ||
    searchParams.get("diagnosisId") ||
    null;

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeDiagnosisId, setActiveDiagnosisId] =
    useState(initialDiagnosisId);
  const [diagnosisInfo, setDiagnosisInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState("");

  // Mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // Silent fallback if initial list fetch fails
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Start a new diagnosis-linked chat when ?diagnosis=ID changes in the URL
  useEffect(() => {
    if (initialDiagnosisId) {
      setActiveConversationId(null);
      setActiveDiagnosisId(initialDiagnosisId);
      setMessages([]);
      setChatError(null);
      setLastFailedMessage("");
    }
  }, [initialDiagnosisId]);

  // Load diagnosis details (disease name + thumbnail) for the context chip
  useEffect(() => {
    if (!activeDiagnosisId) {
      setDiagnosisInfo(null);
      return;
    }
    let active = true;
    getDiagnosisById(activeDiagnosisId)
      .then((res) => {
        if (active && res?.diagnosis) {
          setDiagnosisInfo(res);
        }
      })
      .catch(() => {
        if (active) {
          setDiagnosisInfo(null);
        }
      });
    return () => {
      active = false;
    };
  }, [activeDiagnosisId]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Auto-grow textarea height
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 150);
    el.style.height = `${Math.max(44, nextHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  const handleSelectConversation = async (convId) => {
    if (!convId || sending) return;
    setDrawerOpen(false);
    setChatError(null);
    setLastFailedMessage("");
    setActiveConversationId(convId);
    setLoadingMessages(true);
    try {
      const detail = await getConversationById(convId);
      setMessages(Array.isArray(detail?.messages) ? detail.messages : []);
      setActiveDiagnosisId(detail?.diagnosis_id || null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewChat = () => {
    if (sending) return;
    setActiveConversationId(null);
    setActiveDiagnosisId(null);
    setDiagnosisInfo(null);
    setMessages([]);
    setInputText("");
    setChatError(null);
    setLastFailedMessage("");
    setDrawerOpen(false);
    if (initialDiagnosisId) {
      setSearchParams({}, { replace: true });
    }
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleSend = async (overrideMessage = null) => {
    const rawText =
      typeof overrideMessage === "string" ? overrideMessage : inputText;
    const trimmed = rawText.trim();
    if (!trimmed || sending || trimmed.length > MAX_MESSAGE_LENGTH) return;

    const nowIso = new Date().toISOString();
    const optimisticUserMsg = {
      role: "user",
      content: trimmed,
      created_at: nowIso,
    };

    if (typeof overrideMessage !== "string") {
      setInputText("");
    }
    setChatError(null);
    setLastFailedMessage("");
    setSending(true);

    // Add optimistic user message if not already the last message from a failed attempt
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (
        overrideMessage &&
        last &&
        last.role === "user" &&
        last.content === trimmed
      ) {
        return prev;
      }
      return [...prev, optimisticUserMsg];
    });

    try {
      const res = await sendChatMessage({
        message: trimmed,
        conversationId: activeConversationId,
        diagnosisId: activeDiagnosisId,
        language: lang === "si" ? "si" : "en",
      });

      const assistantMsg = {
        role: "assistant",
        content: res.reply,
        created_at: res.created_at || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.conversation_id) {
        setActiveConversationId(res.conversation_id);
      }

      loadConversations();
    } catch (err) {
      const status = err?.response?.status;
      let friendlyMsg = extractErrorMessage(err, t("assistant.networkError"));
      if (status === 429) {
        friendlyMsg =
          err?.response?.data?.detail || t("assistant.rateLimitError");
      } else if (!err?.response) {
        friendlyMsg = t("assistant.networkError");
      }
      setChatError({
        status,
        message: friendlyMsg,
      });
      setLastFailedMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteConversation(deleteTarget.id);
      toast.success(t("assistant.deletedToast"));
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (activeConversationId === deleteTarget.id) {
        setActiveConversationId(null);
        setMessages([]);
        setChatError(null);
        setLastFailedMessage("");
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const suggestedChips =
    SUGGESTED_QUESTIONS[lang === "si" ? "si" : "en"] || SUGGESTED_QUESTIONS.en;

  const renderConversationSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <Button
          variant="primary"
          size="sm"
          fullWidth
          icon={MessageSquarePlus}
          onClick={handleNewChat}
          disabled={sending}
        >
          {t("assistant.newChat")}
        </Button>
      </div>

      <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t("assistant.conversationsTitle")}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">
          {conversations.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-1">
        {loadingList ? (
          <div className="py-10 flex justify-center">
            <Spinner size="sm" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">
              {t("assistant.noConversations")}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t("assistant.noConversationsHint")}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-emerald-50/90 text-[#166534] border border-emerald-200/80"
                    : "text-slate-700 hover:bg-slate-100/80 border border-transparent"
                }`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">
                    {conv.title || t("assistant.newChat")}
                  </p>
                  {conv.updated_at && (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {formatTimeAgo(conv.updated_at, lang)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(conv);
                  }}
                  aria-label="Delete conversation"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#dc2626] hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-9rem)] min-h-[500px] flex gap-4">
      {/* ================= DESKTOP CONVERSATIONS LIST (LEFT) ================= */}
      <Card
        padding="p-0"
        className="hidden md:flex md:flex-col w-72 shrink-0 overflow-hidden"
      >
        {renderConversationSidebarContent()}
      </Card>

      {/* ================= MOBILE CONVERSATIONS DRAWER ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10 w-76 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col border-r border-slate-200">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#166534] flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="text-sm font-extrabold text-slate-900">
                  {t("assistant.conversationsTitle")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {renderConversationSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN CHAT AREA (RIGHT) ================= */}
      <Card
        padding="p-0"
        className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8faf5]/50"
      >
        {/* Chat Header */}
        <div className="px-3.5 sm:px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl border border-slate-200 bg-[#f8faf5] text-slate-700 hover:bg-emerald-50 hover:text-[#166534] transition-colors shrink-0 cursor-pointer"
              aria-label={t("assistant.openConversations")}
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Small AI Avatar */}
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#166534] to-[#15803d] text-white flex items-center justify-center shadow-xs shrink-0">
              <Bot className="w-5 h-5" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#84cc16] ring-2 ring-white" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {t("assistant.headerTitle")}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {t("assistant.headerSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeDiagnosisId && (
              <Link
                to={`/farmer/scan/${activeDiagnosisId}`}
                className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#166534] border border-emerald-200 transition-colors max-w-[180px] sm:max-w-[260px]"
                title={t("assistant.diagnosisContextBadge")}
              >
                {diagnosisInfo?.diagnosis?.image_url ? (
                  <img
                    src={getImageUrl(diagnosisInfo.diagnosis.image_url)}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover border border-emerald-300 shrink-0"
                  />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 ml-1 shrink-0" />
                )}
                <span className="truncate">
                  {diagnosisInfo?.diagnosis
                    ? lang === "si" && diagnosisInfo?.treatment?.disease_name_si
                      ? diagnosisInfo.treatment.disease_name_si
                      : lang === "en" &&
                        diagnosisInfo?.treatment?.disease_name_en
                      ? diagnosisInfo.treatment.disease_name_en
                      : formatDiseaseKey(
                          diagnosisInfo.diagnosis.officer_label ||
                            diagnosisInfo.diagnosis.predicted_class,
                          lang
                        )
                    : t("assistant.diagnosisContextBadge")}
                </span>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={MessageSquarePlus}
              onClick={handleNewChat}
              disabled={sending}
              className="md:hidden"
            >
              <span className="sr-only sm:not-sr-only">
                {t("assistant.newChat")}
              </span>
            </Button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : messages.length === 0 && !sending ? (
            /* Empty state + Suggested question chips */
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-2 py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#166534] flex items-center justify-center mb-3 shadow-xs">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {t("assistant.emptyTitle")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                {t("assistant.emptySubtitle")}
              </p>

              <div className="w-full mt-6">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  {t("assistant.suggestedLabel")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedChips.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={sending}
                      onClick={() => handleSend(question)}
                      className="text-left px-3.5 py-2.5 rounded-xl bg-white hover:bg-emerald-50/80 border border-slate-200/90 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-[#166534] shadow-2xs transition-all cursor-pointer"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const timeStr = formatMessageTime(msg.created_at, lang);

                return (
                  <div
                    key={`${msg.created_at || idx}-${idx}`}
                    className={`flex items-start gap-2.5 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-[#166534] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words ${
                          isUser
                            ? "bg-[#166534] text-white rounded-br-xs shadow-xs"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1.5 prose-ul:list-disc prose-ul:pl-4 prose-ol:my-1.5 prose-ol:list-decimal prose-ol:pl-4 prose-li:my-0.5 prose-strong:text-slate-900">
                            <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {timeStr && (
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {timeStr}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator (3 animated dots) while waiting */}
              {sending && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-[#166534] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-xs bg-white border border-slate-200/80 shadow-xs flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full bg-[#166534] animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[#166534] animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[#166534] animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error banner (429 / network) with Retry button */}
          {chatError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                <p className="text-xs font-semibold leading-relaxed">
                  {chatError.message}
                </p>
              </div>
              {lastFailedMessage && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={RotateCcw}
                  disabled={sending}
                  onClick={() => handleSend(lastFailedMessage)}
                  className="self-end sm:self-auto shrink-0 border-red-200 text-red-700 hover:bg-red-100"
                >
                  {t("assistant.retryBtn")}
                </Button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80 shrink-0">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={sending}
                onChange={(e) =>
                  setInputText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                }
                onKeyDown={handleKeyDown}
                placeholder={t("assistant.inputPlaceholder")}
                className="w-full resize-none rounded-xl bg-[#f8faf5] border border-slate-200 px-3.5 py-2.5 pr-16 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              />
              <span
                className={`absolute bottom-2 right-2.5 text-[10px] font-semibold select-none ${
                  inputText.length >= MAX_MESSAGE_LENGTH
                    ? "text-[#dc2626]"
                    : "text-slate-400"
                }`}
              >
                {inputText.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={Send}
              disabled={sending || !inputText.trim()}
              loading={sending}
              onClick={() => handleSend()}
              aria-label={t("assistant.sendBtn")}
              className="shrink-0 h-[44px] px-3.5 sm:px-4"
            >
              <span className="hidden sm:inline">{t("assistant.sendBtn")}</span>
            </Button>
          </div>

          <p className="mt-2 text-[11px] text-center text-slate-500">
            {t("assistant.disclaimer")}
          </p>
        </div>
      </Card>

      {/* Delete Conversation Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t("assistant.deleteConfirmTitle")}
        description={t("assistant.deleteConfirmDesc")}
        confirmLabel={t("assistant.deleteConfirmBtn")}
        cancelLabel={t("assistant.deleteCancelBtn")}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
