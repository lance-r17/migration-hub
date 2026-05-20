"""MCP authentication helpers.

The SSE router reuses the existing ``app.auth.get_current_user`` dependency
directly, so this module is reserved for future MCP-specific auth extensions
(e.g. session-scoped API keys, per-tool permission checks).
"""

from app.auth import get_current_user  # noqa: F401
