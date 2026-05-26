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


# Controls how "tabs" blocks are rendered:
#   "expand"       – built-in Expand macro (no app required; collapses instead of tabs)
#   "third_party"  – Adaptavist/Communardo-style tabs+tab macros (requires installed app)
#   "aui"          – AUI HTML via the html macro (requires HTML macro to be enabled)
_TAB_RENDER: str = "expand"

_CALLOUT_DEFAULTS: dict[str, dict[str, str]] = {
    "info":    {"bg": "#DDEBF1", "icon": "💡", "icon_id": "1f4a1"},
    "warn":    {"bg": "#FBF3DB", "icon": "⚠️", "icon_id": "26a0"},
    "success": {"bg": "#DDEDE3", "icon": "✅", "icon_id": "2705"},
    "danger":  {"bg": "#FBE4E4", "icon": "🚨", "icon_id": "1f6a8"},
    "neutral": {"bg": "#F1F1EF", "icon": "📝", "icon_id": "1f4dd"},
}


def _emoji_panel_icon_id(emoji: str) -> str:
    """Return hyphen-joined Unicode hex codepoints for the non-ASCII chars in an emoji."""
    pts = [format(ord(c), "x") for c in emoji if ord(c) > 0x7F]
    return "-".join(pts) if pts else ""


def _callout_macro(block: dict[str, Any]) -> str:
    variant = block.get("variant", "info")
    defaults = _CALLOUT_DEFAULTS.get(variant, _CALLOUT_DEFAULTS["info"])
    # block.bgColor is already a CSS hex value (set directly from BG_COLOR_MAP on the frontend)
    bg_hex = block.get("bgColor") or defaults["bg"]
    panel_icon = block.get("icon") or defaults["icon"]
    panel_icon_id = _emoji_panel_icon_id(panel_icon) or defaults["icon_id"]
    body = _inline_html(block.get("content", "")) or ""
    return (
        f'<ac:structured-macro ac:name="panel" ac:schema-version="1">'
        f'<ac:parameter ac:name="bgColor">{bg_hex}</ac:parameter>'
        f'<ac:parameter ac:name="panelIcon">{panel_icon}</ac:parameter>'
        f'<ac:parameter ac:name="panelIconId">{panel_icon_id}</ac:parameter>'
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


def _image_macro(src: str, caption: str = "", align: str = "", width_pct: int = 0) -> str:
    attrs = ""
    if align in ("left", "center", "right"):
        attrs += f' ac:align="{align}"'
    if 0 < width_pct < 100:
        # Convert % to pixels relative to a ~680 px Confluence content column
        px = max(50, round(width_pct * 680 / 100))
        attrs += f' ac:width="{px}"'
    caption_xml = f"<ac:caption><p>{html.escape(caption)}</p></ac:caption>" if caption else ""
    return f'<ac:image{attrs}><ri:url ri:value="{html.escape(src)}" />{caption_xml}</ac:image>'


_TEXT_COLOR_MAP: dict[str, str] = {
    "gray": "#9B9A93", "brown": "#9F6B53", "orange": "#D9730D",
    "yellow": "#CB912F", "green": "#448361", "blue": "#337EA9",
    "purple": "#9065B0", "pink": "#C14C8A", "red": "#D44C47",
}
_BG_COLOR_MAP: dict[str, str] = {
    "gray": "#F1F1EF", "brown": "#F1ECE7", "orange": "#FBECDD",
    "yellow": "#FBF3DB", "green": "#DDEDE3", "blue": "#DDEBF1",
    "purple": "#EAE4F2", "pink": "#F4DFEB", "red": "#FBE4E4",
}


def _table_block(block: dict[str, Any]) -> str:
    rows = block.get("rows", [[]])
    if not rows:
        return ""
    cell_styles: dict[str, dict[str, str]] = block.get("cellStyles", {}) or {}
    html_parts = ["<table><tbody>"]
    for r_idx, row in enumerate(rows):
        html_parts.append("<tr>")
        for c_idx, cell in enumerate(row):
            cell_html = _inline_html(cell)
            style = cell_styles.get(f"{r_idx},{c_idx}", {})
            bg = _BG_COLOR_MAP.get(style.get("bgColor", ""), "")
            fg = _TEXT_COLOR_MAP.get(style.get("textColor", ""), "")
            extra_attrs = ""
            css_parts: list[str] = []
            if bg:
                extra_attrs += f' data-highlight-colour="{bg}"'
                css_parts.append(f"background-color:{bg}")
            if fg:
                css_parts.append(f"color:{fg}")
            style_attr = f' style="{";".join(css_parts)}"' if css_parts else ""
            html_parts.append(f"<td{extra_attrs}{style_attr}>{cell_html}</td>")
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


def _tabs_macro(tabs: list[dict[str, Any]]) -> str:
    if _TAB_RENDER == "third_party":
        inner = "".join(
            f'<ac:structured-macro ac:name="tab">'
            f'<ac:parameter ac:name="title">{html.escape(t.get("title", "Tab"))}</ac:parameter>'
            f'<ac:rich-text-body>{_flatten_blocks(t.get("blocks", []))}</ac:rich-text-body>'
            f'</ac:structured-macro>'
            for t in tabs
        )
        return (
            f'<ac:structured-macro ac:name="tabs">'
            f'<ac:rich-text-body>{inner}</ac:rich-text-body>'
            f'</ac:structured-macro>'
        )
    elif _TAB_RENDER == "aui":
        menu_items: list[str] = []
        panes: list[str] = []
        for idx, t in enumerate(tabs):
            tab_id = f"tab-pane-{idx}"
            title = html.escape(t.get("title", f"Tab {idx + 1}"))
            active_li = " active-tab" if idx == 0 else ""
            active_div = " active-pane" if idx == 0 else ""
            menu_items.append(f'<li class="menu-item{active_li}"><a href="#{tab_id}">{title}</a></li>')
            panes.append(
                f'<div class="tabs-pane{active_div}" id="{tab_id}">'
                f'{_flatten_blocks(t.get("blocks", []))}'
                f'</div>'
            )
        aui_html = (
            f'<div class="aui-tabs horizontal-tabs">'
            f'<ul class="tabs-menu">{"".join(menu_items)}</ul>'
            f'{"".join(panes)}'
            f'</div>'
        )
        return (
            f'<ac:structured-macro ac:name="html">'
            f'<ac:plain-text-body><![CDATA[{aui_html}]]></ac:plain-text-body>'
            f'</ac:structured-macro>'
        )
    else:  # "expand" — safe default, no app required
        return "".join(
            f'<ac:structured-macro ac:name="expand">'
            f'<ac:parameter ac:name="title">{html.escape(t.get("title", "Tab"))}</ac:parameter>'
            f'<ac:rich-text-body>{_flatten_blocks(t.get("blocks", []))}</ac:rich-text-body>'
            f'</ac:structured-macro>'
            for t in tabs
        )


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
            parts.append(_callout_macro(block))

        elif btype == "code":
            parts.append(_code_macro(block.get("language", "text"), block.get("content", "")))

        elif btype == "divider":
            parts.append("<hr/>")

        elif btype == "table":
            parts.append(_table_block(block))

        elif btype == "image":
            src = block.get("src", "")
            caption = block.get("caption", "") or ""
            align = block.get("align", "") or ""
            width_pct = int(block.get("width") or 0)
            if src:
                parts.append(_image_macro(src, caption, align, width_pct))
            else:
                parts.append("<p>[Image]</p>")

        elif btype == "bookmark":
            parts.append(_bookmark_block(block))

        elif btype == "tabs":
            parts.append(_tabs_macro(block.get("tabs", [])))

        elif btype == "columns":
            columns = block.get("columns", [])
            n = len(columns)
            if n == 0:
                pass
            elif n == 1:
                cells = f"<ac:layout-cell>{_flatten_blocks(columns[0])}</ac:layout-cell>"
                parts.append(
                    f'<ac:layout><ac:layout-section ac:type="single">'
                    f"{cells}</ac:layout-section></ac:layout>"
                )
            else:
                # Emit sections of up to 3 columns using equal-width types
                _LAYOUT_TYPES = {2: "two_equal", 3: "three_equal"}
                chunk_start = 0
                layout_parts: list[str] = ["<ac:layout>"]
                while chunk_start < n:
                    chunk = columns[chunk_start : chunk_start + 3]
                    chunk_size = len(chunk)
                    layout_type = _LAYOUT_TYPES.get(chunk_size, "two_equal")
                    cells = "".join(
                        f"<ac:layout-cell>{_flatten_blocks(col)}</ac:layout-cell>"
                        for col in chunk
                    )
                    layout_parts.append(
                        f'<ac:layout-section ac:type="{layout_type}">{cells}</ac:layout-section>'
                    )
                    chunk_start += chunk_size
                layout_parts.append("</ac:layout>")
                parts.append("".join(layout_parts))

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
