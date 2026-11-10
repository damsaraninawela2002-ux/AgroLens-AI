from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import smtplib
from app.core.config import settings

logger = logging.getLogger(__name__)


def build_password_reset_link(token: str) -> str:
    """Build the frontend password reset URL for the given token."""
    frontend_url = (settings.FRONTEND_URL or "http://localhost:5173").strip().rstrip("/")
    return f"{frontend_url}/reset-password?token={token}"


def _print_reset_link_to_terminal(to_email: str, reset_link: str, reason: str) -> None:
    """Print the password reset link clearly to the backend terminal (dev fallback)."""
    separator = "=" * 72
    print(f"\n{separator}")
    print("[AgroLens AI - Password Reset Link]")
    print(f"Reason : {reason}")
    print(f"Email  : {to_email}")
    print(f"Link   : {reset_link}")
    print("Note   : This one-time link expires in 15 minutes.")
    print(f"{separator}\n", flush=True)


def send_password_reset_email(to_email: str, token: str) -> str:
    """
    Send a bilingual (Sinhala + English) password reset email via SMTP.
    If SMTP_HOST, SMTP_USER, or SMTP_PASSWORD is empty, or if sending fails,
    prints the reset link clearly in the backend terminal without raising.
    """
    reset_link = build_password_reset_link(token)

    smtp_host = (settings.SMTP_HOST or "").strip()
    smtp_port = int(settings.SMTP_PORT or 587)
    smtp_user = (settings.SMTP_USER or "").strip()
    smtp_password = (settings.SMTP_PASSWORD or "").strip()
    email_from = (settings.EMAIL_FROM or smtp_user or "noreply@agrolens.lk").strip()

    # Development fallback when SMTP credentials are not configured
    if not smtp_host or not smtp_user or not smtp_password:
        _print_reset_link_to_terminal(
            to_email=to_email,
            reset_link=reset_link,
            reason="SMTP not configured (development fallback)",
        )
        return reset_link

    subject = "AgroLens AI – Reset Password / මුරපදය යළි සකසන්න"

    text_body = (
        "AgroLens AI – Password Reset / මුරපදය යළි සැකසීම\n\n"
        "සිංහල:\n"
        "ඔබගේ AgroLens AI ගිණුමේ මුරපදය යළි සැකසීමට පහත සබැඳිය භාවිතා කරන්න.\n"
        "මෙම සබැඳිය මිනිත්තු 15 කින් කල් ඉකුත් වේ.\n\n"
        "English:\n"
        "Use the link below to reset your AgroLens AI account password.\n"
        "This link expires in 15 minutes.\n\n"
        f"{reset_link}\n"
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>AgroLens AI – Reset Password</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#f8faf5;font-family:'Plus Jakarta Sans','Noto Sans Sinhala',Arial,sans-serif;color:#0f172a;">
    <div style="max-width:540px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <div style="margin-bottom:20px;border-bottom:1px solid #f1f5f9;padding-bottom:16px;">
        <h2 style="margin:0;color:#166534;font-size:22px;font-weight:800;">AgroLens AI</h2>
        <p style="margin:4px 0 0 0;font-size:13px;color:#475569;">
          Password Reset Request • මුරපදය යළි සැකසීමේ ඉල්ලීම
        </p>
      </div>

      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#1e293b;">
        ඔබගේ AgroLens AI ගිණුමේ මුරපදය යළි සැකසීමට පහත බොත්තම ඔබන්න. මෙම සබැඳිය <strong>මිනිත්තු 15 කින්</strong> කල් ඉකුත් වේ.
      </p>

      <p style="margin:0 0 22px 0;font-size:14px;line-height:1.7;color:#334155;">
        Click the button below to reset your AgroLens AI password. This one-time link expires in <strong>15 minutes</strong>.
      </p>

      <div style="text-align:center;margin:26px 0;">
        <a
          href="{reset_link}"
          style="display:inline-block;background-color:#166534;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:12px;"
        >
          Reset Password / මුරපදය සකසන්න
        </a>
      </div>

      <p style="margin:20px 0 6px 0;font-size:12px;color:#64748b;">
        If the button above does not work, copy and paste this link into your browser / බොත්තම ක්‍රියා නොකරන්නේ නම් මෙම සබැඳිය භාවිතා කරන්න:
      </p>
      <p style="margin:0 0 20px 0;font-size:12px;word-break:break-all;background-color:#f8faf5;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;">
        <a href="{reset_link}" style="color:#166534;text-decoration:underline;">{reset_link}</a>
      </p>

      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        If you did not request a password reset, you can safely ignore this email. / ඔබ මෙම ඉල්ලීම සිදු නොකළේ නම් මෙම පණිවිඩය නොසලකා හරින්න.
      </p>
    </div>
  </body>
</html>"""

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = email_from
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(email_from, [to_email], message.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_password)
                server.sendmail(email_from, [to_email], message.as_string())
    except Exception as exc:
        logger.error("Failed to send password reset email to %s: %s", to_email, exc)
        _print_reset_link_to_terminal(
            to_email=to_email,
            reset_link=reset_link,
            reason=f"SMTP send failed ({type(exc).__name__}: {exc})",
        )

    return reset_link
