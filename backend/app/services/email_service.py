import logging

import aiosmtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    *,
    to_addrs: list[str],
    subject: str,
    html_content: str,
    from_addr: str | None = None,
) -> None:
    """Send an HTML email via the configured SMTP server."""
    if not to_addrs:
        raise ValueError("At least one recipient is required")

    sender = from_addr or settings.smtp_from or settings.smtp_user or "no-reply@localhost"

    if settings.console_email:
        logger.info(
            "\n========== CONSOLE EMAIL ==========\n"
            "From:    %s\n"
            "To:      %s\n"
            "Subject: %s\n"
            "-----------------------------------\n"
            "%s\n"
            "===================================",
            sender, ", ".join(to_addrs), subject, html_content[:2000],
        )
        return

    if not settings.smtp_host:
        raise RuntimeError("SMTP host is not configured")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = ", ".join(to_addrs)
    message["Subject"] = subject
    message.add_alternative(html_content, subtype="html")

    try:
        if settings.smtp_port == 465 or settings.smtp_secure:
            # Implicit TLS (SSL from connect) — port 465 or explicit secure flag
            client = aiosmtplib.SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                use_tls=True,
            )
            async with client:
                if settings.smtp_user:
                    await client.login(settings.smtp_user, settings.smtp_password or "")
                await client.send_message(message)
        else:
            # STARTTLS — port 587 (default)
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user or None,
                password=settings.smtp_password or None,
                start_tls=True,
            )
    except aiosmtplib.errors.SMTPConnectError as exc:
        raise RuntimeError(
            f"Cannot connect to {settings.smtp_host}:{settings.smtp_port}. "
            "If you're behind a firewall, try port 465 with SMTP_SECURE=true, "
            f"or use CONSOLE_EMAIL=true for development. Original error: {exc}"
        ) from exc

    logger.info("Email sent to %s | subject: %s", to_addrs, subject)
