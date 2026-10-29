import { useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import Modal from "./Modal";
import Button from "../ui/Button";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  description = "Are you sure you want to proceed?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  requireTypedText = "",
  typedPromptLabel = "Type to confirm",
}) {
  const [typedValue, setTypedValue] = useState("");

  const handleClose = () => {
    if (loading) return;
    setTypedValue("");
    onClose?.();
  };

  const handleConfirm = async () => {
    await onConfirm?.();
    setTypedValue("");
  };

  const isConfirmDisabled =
    loading ||
    (Boolean(requireTypedText) &&
      typedValue.trim() !== requireTypedText.trim());

  const isDanger = variant === "danger";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            disabled={loading}
            onClick={handleClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? "danger" : "primary"}
            size="md"
            icon={isDanger ? Trash2 : CheckCircle2}
            loading={loading}
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3.5 p-4 rounded-2xl border ${
            isDanger
              ? "bg-red-50/70 border-red-200/80 text-red-900"
              : "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              isDanger ? "text-[#dc2626]" : "text-[#166534]"
            }`}
          />
          <p className="text-xs sm:text-sm leading-relaxed">{description}</p>
        </div>

        {requireTypedText && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              {typedPromptLabel}:{" "}
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 text-[#dc2626] select-all">
                {requireTypedText}
              </span>
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requireTypedText}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
