import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import resend

from .markdown import markdown_to_html


def _get_env(*keys, default=None):
    for key in keys:
        value = os.getenv(key)
        if value not in (None, ''):
            return value
    return default


def _send_email_smtp(to: str, subject: str, content_html: str, content_text: str, from_email: str, from_name: str) -> None:
    """Send email via SMTP (for local development with MailHog).
    
    Args:
        to: Recipient email address
        subject: Email subject line
        content_html: HTML content for the email body
        content_text: Plain text content for the email body
        from_email: Sender email address
        from_name: Sender name
    """
    # Format From field: "Name <email@example.com>" or just email
    if from_name:
        from_field = f"{from_name} <{from_email}>"
    else:
        from_field = from_email
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['From'] = from_field
    msg['To'] = to
    msg['Subject'] = subject
    
    # Add both plain text and HTML parts
    part1 = MIMEText(content_text, 'plain')
    part2 = MIMEText(content_html, 'html')
    msg.attach(part1)
    msg.attach(part2)
    
    # Send via SMTP (MailHog default: localhost:1025)
    try:
        smtp_host = _get_env('API_SMTP_HOST', 'SMTP_HOST', default='localhost')
        smtp_port = int(_get_env('API_SMTP_PORT', 'SMTP_PORT', default='1025'))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            # MailHog doesn't require authentication
            server.send_message(msg)
    except Exception as e:
        # Fail gracefully - log but don't raise
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to send email via SMTP: {e}")
        raise


def _send_email_resend(to: str, subject: str, content_html: str, content_text: str, from_email: str, from_name: str) -> None:
    """Send email via Resend.

    Args:
        to: Recipient email address
        subject: Email subject line
        content_html: HTML content for the email body
        content_text: Plain text content for the email body (fallback)
        from_email: Sender email address
        from_name: Sender name
    """
    # Initialize Resend
    api_key = _get_env('API_RESEND_API_KEY', 'RESEND_API_KEY')
    if not api_key:
        raise ValueError("API_RESEND_API_KEY environment variable must be set")

    resend.api_key = api_key

    # Format From field
    if from_name:
        from_field = f"{from_name} <{from_email}>"
    else:
        from_field = from_email

    # Send via Resend
    params = {
        "from": from_field,
        "to": [to],
        "subject": subject,
        "html": content_html,
        "text": content_text,
    }

    resend.Emails.send(params)


def send_email(to: str, subject: str, content_html: str, content_text: str) -> None:
    """Send an email. Uses SMTP for local development or Resend for production.

    Args:
        to: Recipient email address
        subject: Email subject line
        content_html: HTML content for the email body
        content_text: Plain text content for the email body (fallback)
    """
    # Check if email sending is enabled
    send_email_flag = _get_env('API_SEND_EMAIL_FLAG', 'SEND_EMAIL_FLAG', default='false').lower() in (
        'true', '1', 't'
    )
    if not send_email_flag:
        return

    from_email = _get_env('API_FROM_EMAIL', 'FROM_EMAIL')
    from_name = _get_env('API_FROM_NAME', 'FROM_NAME', default='VaultSQL')

    if not from_email:
        raise ValueError("API_FROM_EMAIL environment variable must be set")

    # Determine which email service to use
    use_resend = _get_env('API_USE_RESEND', 'USE_RESEND', default='false').lower() in (
        'true', '1', 't'
    )

    try:
        if use_resend:
            _send_email_resend(to, subject, content_html, content_text, from_email, from_name)
        else:
            # Default to SMTP for local development
            _send_email_smtp(to, subject, content_html, content_text, from_email, from_name)
    except Exception as e:
        # Fail gracefully - log but don't raise to avoid breaking notification creation
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send email: {e}", exc_info=True)
        # Don't raise - notification is still created in database
