import re
from html import escape


def markdown_to_html(markdown: str) -> str:
    """Convert basic markdown to HTML. Bare minimum implementation.
    
    Supports:
    - Headers (# ## ###)
    - Bold (**text**)
    - Links ([text](url))
    - Paragraphs (double newline)
    - Line breaks (single newline)
    """
    if not markdown:
        return ""
    
    html = markdown
    
    # Headers
    html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    
    # Bold
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    
    # Links
    html = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', html)
    
    # Split into paragraphs (double newline)
    paragraphs = html.split('\n\n')
    processed_paragraphs = []
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        # Convert single newlines to <br>
        para = para.replace('\n', '<br>')
        
        # Wrap in <p> if not already a header
        if not para.startswith('<h'):
            para = f'<p>{para}</p>'
        
        processed_paragraphs.append(para)
    
    html = '\n'.join(processed_paragraphs)
    
    # Escape any remaining HTML that wasn't processed
    # But preserve our generated tags
    lines = html.split('\n')
    escaped_lines = []
    for line in lines:
        if line.startswith('<') and line.endswith('>'):
            # Already HTML tag, keep as is
            escaped_lines.append(line)
        else:
            # Escape HTML but preserve our tags
            escaped = escape(line)
            # Unescape our tags
            escaped = escaped.replace('&lt;h1&gt;', '<h1>').replace('&lt;/h1&gt;', '</h1>')
            escaped = escaped.replace('&lt;h2&gt;', '<h2>').replace('&lt;/h2&gt;', '</h2>')
            escaped = escaped.replace('&lt;h3&gt;', '<h3>').replace('&lt;/h3&gt;', '</h3>')
            escaped = escaped.replace('&lt;strong&gt;', '<strong>').replace('&lt;/strong&gt;', '</strong>')
            escaped = escaped.replace('&lt;a href=', '<a href=').replace('&lt;/a&gt;', '</a>')
            escaped = escaped.replace('&quot;', '"')
            escaped = escaped.replace('&lt;br&gt;', '<br>')
            escaped = escaped.replace('&lt;p&gt;', '<p>').replace('&lt;/p&gt;', '</p>')
            escaped_lines.append(escaped)
    
    return '\n'.join(escaped_lines)

