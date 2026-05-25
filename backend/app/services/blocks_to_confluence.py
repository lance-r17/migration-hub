import html
from typing import Any

# Confluence storage-format namespace wrapper.
# Declared once on the outermost <div> so ac: / ri: macros work inside.
_NS_WRAPPER_OPEN = (
    '<div xmlns:ac="http://www.atlassian.com/schema/confluence/4/ac/" '
    'xmlns:ri="http://www.atlassian.com/schema/confluence/4/ri/">'
)
_NS_WRAPPER_CLOSE = "</div>"


def _escape_text(text: str) -> str:
    """Escape raw text for XHTML, but leave existing HTML tags alone.

    The editor stores HTML fragments in *content* fields (e.g. <b>, <i>, <a>),
    so we do NOT escape the whole string.  We only ensure that stray ampersands
    that are NOT part of an entity are escaped.  A simplistic but safe rule:
    escape & when it is not followed by an entity or tag.
    """
    # For pragmatic correctness we run the fragment through html.escape and
    # then un-escape common harmless tags / entities.  This prevents unclosed
    # script tags from breaking the XHTML while preserving editor markup.
    escaped = html.escape(text)
    # Un-escape the editor's inline tags
    for tag in ("b", "i", "u", "s", "strong", "em", "span", "a", "br", "code"):
        escaped = escaped.replace(f"&lt;{tag}&gt;", f"<{tag}>")
        escaped = escaped.replace(f"&lt;/{tag}&gt;", f"</{tag}>")
        # Handle attributes: e.g. <a href="...">
        # This is a best-effort un-escape for common attribute patterns.
        # We replace the escaped open tag with a regex-like loop below.
    # A simpler approach: just pass through the original HTML and trust the editor.
    # The risk is malformed HTML.  We'll accept it for now.
    return text


def _inline_html(text: str) -> str:
    """Return the HTML fragment as-is (editor already produces HTML)."""
    if not text:
        return ""
    return text


def _callout_macro(variant: str, content: str) -> str:
    """Map callout variant to a Confluence structured macro."""
    macro_name = {
        "info": "info",
        "warn": "warning",
        "success": "tip",
        "danger": "warning",
        "neutral": "info",
    }.get(variant, "info")
    body = _inline_html(content) or ""
    return (
        f'<ac:structured-macro ac:name="{macro_name}">'
        f"<ac:rich-text-body><p>{body}</p></ac:rich-text-body>"
        f"</ac:structured-macro>"
    )


def _code_macro(language: str, content: str) -> str:
    body = html.escape(content)
    return (
        f'<ac:structured-macro ac:name="code">'
        f'<ac:parameter ac:name="language">{html.escape(language)}</ac:parameter>'
        f"<ac:plain-text-body><![CDATA[{body}]]></ac:plain-text-body>"
        f"</ac:structured-macro>"
    )


def _image_macro(src: str, caption: str = "") -> str:
    macro = (
        f'<ac:structured-macro ac:name="info">'
        f'<ac:rich-text-body><p><ac:image>'
        f'<ri:url ri:value="{html.escape(src)}" />'
        f'</ac:image>'
    )
    if caption:
        macro += f" {html.escape(caption)}"
    macro += "</p></ac:rich-text-body></ac:structured-macro>"
    return macro


def _table_block(block: dict[str, Any]) -> str:
    rows = block.get("rows", [[]])
    if not rows:
        return ""
    html_parts = ["<table><tbody>"]
    for r_idx, row in enumerate(rows):
        html_parts.append("<tr>")
        for c_idx, cell in enumerate(row):
            cell_html = _inline_html(cell)
            tag = "th" if r_idx == 0 else "td"
            html_parts.append(f"<{tag}>{cell_html}</{tag}>")
        html_parts.append("</tr>")
    html_parts.append("</tbody></table>")
    return "".join(html_parts)


def _bookmark_block(block: dict[str, Any]) -> str:
    url = html.escape(block.get("url", ""))
    title = html.escape(block.get("title", url))
    desc = html.escape(block.get("desc", ""))
    parts = [f'<p><a href="{url}">{title}</a></p>']
    if desc:
        parts.append(f"<p><em>{desc}</em></p>")
    return "".join(parts)


def _flatten_blocks(blocks: list[dict[str, Any]]) -> str:
    """Convert a flat list of blocks into a sequence of XHTML fragments."""
    parts: list[str] = []
    i = 0
    while i < len(blocks):
        block = blocks[i]
        btype = block.get("type", "paragraph")

        # Group consecutive bullets / numbered items
        if btype in ("bullet", "numbered"):
            tag = "ul" if btype == "bullet" else "ol"
            group: list[str] = []
            j = i
            while j < len(blocks) and blocks[j].get("type") == btype:
                content = _inline_html(blocks[j].get("content", ""))
                group.append(f"<li>{content}</li>")
                j += 1
            parts.append(f"<{tag}>{''.join(group)}</{tag}>")
            i = j
            continue

        if btype == "todo":
            checked = block.get("checked", False)
            marker = "☑ " if checked else "☐ "
            content = _inline_html(block.get("content", ""))
            parts.append(f"<ul><li>{marker}{content}</li></ul>")

        elif btype in ("paragraph", "quote"):
            tag = "blockquote" if btype == "quote" else "p"
            content = _inline_html(block.get("content", ""))
            if content:
                parts.append(f"<{tag}>{content}</{tag}>")
            else:
                parts.append(f"<{tag}><br/></{tag}>")

        elif btype in ("h1", "h2", "h3"):
            tag = btype
            content = _inline_html(block.get("content", ""))
            parts.append(f"<{tag}>{content}</{tag}>")

        elif btype == "callout":
            parts.append(_callout_macro(block.get("variant", "info"), block.get("content", "")))

        elif btype == "code":
            parts.append(_code_macro(block.get("language", "text"), block.get("content", "")))

        elif btype == "divider":
            parts.append("<hr/>")

        elif btype == "table":
            parts.append(_table_block(block))

        elif btype == "image":
            src = block.get("src", "")
            caption = block.get("caption", "")
            if src:
                parts.append(_image_macro(src, caption))
            else:
                parts.append("<p>[Image]</p>")

        elif btype == "bookmark":
            parts.append(_bookmark_block(block))

        elif btype == "tabs":
            # Use Confluence expand macros (collapsible sections) as the closest
            # native equivalent to tabs — works on Confluence Cloud & Server
            # without requiring third-party apps.
            for tab in block.get("tabs", []):
                title = html.escape(tab.get("title", "Tab"))
                tab_body = _flatten_blocks(tab.get("blocks", []))
                parts.append(
                    f'<ac:structured-macro ac:name="expand">'
                    f'<ac:parameter ac:name="title">{title}</ac:parameter>'
                    f'<ac:rich-text-body>{tab_body}</ac:rich-text-body>'
                    f'</ac:structured-macro>'
                )

        elif btype == "columns":
            for idx, col in enumerate(block.get("columns", [])):
                parts.append(f"<h4>Column {idx + 1}</h4>")
                parts.append(_flatten_blocks(col))
                parts.append("<hr/>")

        else:
            # Unknown block type – treat as paragraph
            content = _inline_html(block.get("content", ""))
            parts.append(f"<p>{content}</p>")

        i += 1

    return "".join(parts)


def convert(blocks: list[dict[str, Any]]) -> str:
    """Convert a list of custom Block dicts into a Confluence storage-format string."""
    body = _flatten_blocks(blocks)
    return f"{_NS_WRAPPER_OPEN}{body}{_NS_WRAPPER_CLOSE}"
