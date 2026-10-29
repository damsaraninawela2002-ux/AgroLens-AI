import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserCheck,
  XCircle,
} from "lucide-react";
import Badge from "../ui/Badge";

export default function StatusBadge({ type = "status", value, label }) {
  const normalized = String(value || "").toLowerCase();

  if (type === "role") {
    if (normalized === "admin") {
      return (
        <Badge variant="danger" icon={Shield}>
          {label || "Admin"}
        </Badge>
      );
    }
    if (normalized === "officer") {
      return (
        <Badge variant="info" icon={UserCheck}>
          {label || "Officer"}
        </Badge>
      );
    }
    return (
      <Badge variant="success" icon={Sprout}>
        {label || "Farmer"}
      </Badge>
    );
  }

  if (type === "user_status") {
    if (normalized === "inactive") {
      return (
        <Badge variant="danger" icon={XCircle}>
          {label || "Inactive"}
        </Badge>
      );
    }
    if (normalized === "pending_approval") {
      return (
        <Badge variant="warning" icon={Clock}>
          {label || "Pending Approval"}
        </Badge>
      );
    }
    return (
      <Badge variant="success" icon={CheckCircle2}>
        {label || "Active"}
      </Badge>
    );
  }

  if (type === "verified") {
    if (value === true || normalized === "true" || normalized === "verified") {
      return (
        <Badge variant="success" icon={CheckCircle2}>
          {label || "Verified"}
        </Badge>
      );
    }
    return (
      <Badge variant="warning" icon={AlertTriangle}>
        {label || "Unverified"}
      </Badge>
    );
  }

  // Diagnosis status fallback
  if (normalized === "pending_review") {
    return (
      <Badge variant="warning" icon={Clock}>
        {label || "Pending review"}
      </Badge>
    );
  }
  if (normalized === "confirmed") {
    return (
      <Badge variant="success" icon={CheckCircle2}>
        {label || "Confirmed"}
      </Badge>
    );
  }
  if (normalized === "corrected") {
    return (
      <Badge variant="info" icon={ShieldCheck}>
        {label || "Corrected"}
      </Badge>
    );
  }
  if (normalized === "auto") {
    return (
      <Badge variant="success" icon={ShieldCheck}>
        {label || "Auto-Verified"}
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" icon={ShieldAlert}>
      {label || String(value || "Unknown")}
    </Badge>
  );
}
