import re
from pathlib import Path

def load_email_html(template_name: str, context: dict = None) -> str:
    """Load a React Email template HTML file and replace variables safely.

    Args:
        template_name: Name of template file (without .html extension)
        context: Dictionary of variables to replace (e.g., {'code': '123456', 'email': 'user@example.com'})

    Returns:
        HTML string with variables replaced
    """
    # Get the template path relative to this file
    # We assume templates are in a 'templates' sibling directory
    current_dir = Path(__file__).parent
    template_path = current_dir / 'templates' / f'{template_name}.html'

    if not template_path.exists():
        raise FileNotFoundError(f"Email template not found: {template_path}")

    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Replace variables in {{variable}} format
    if context:
        for key, value in context.items():
            # If value is empty string, remove any paragraph containing only this variable
            if value == '':
                # Remove <p>...</p> blocks that contain this empty variable
                # We use a safe regex that ensures we don't matches across multiple paragraphs.
                # (?:(?!</p>).)*? ensures we don't consume a closing p tag before finding our key.
                pattern = f'<p[^>]*>(?:(?!</p>).)*?{{{{{key}}}}}.*?</p>'
                html = re.sub(pattern, '', html, flags=re.DOTALL)
            else:
                html = html.replace(f'{{{{{key}}}}}', str(value))

    return html
