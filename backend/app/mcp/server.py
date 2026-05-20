import logging
from typing import Any

import mcp.types as types
from mcp.server.lowlevel import Server

from app.database import AsyncSessionLocal
from app.mcp.context import mcp_user_ctx
from app.mcp.registry import _registry, _serialize_result

logger = logging.getLogger(__name__)


def create_mcp_server() -> Server:
    """Create and return an MCP Server instance with all registered tools."""
    # Ensure tool modules have been imported so that register_tool decorators ran.
    from app.mcp.tools import discovery, analysis, dashboard  # noqa: F401

    server = Server("migration-hub")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return _registry.get_tools()

    @server.call_tool()
    async def call_tool(tool_name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
        user = mcp_user_ctx.get()
        if user is None:
            return [types.TextContent(type="text", text="Error: Not authenticated")]

        async with AsyncSessionLocal() as db:
            from app.mcp.context import McpContext

            ctx = McpContext(user=user, db=db)
            try:
                result = await _registry.call(tool_name, arguments, ctx)
                return _serialize_result(result)
            except Exception as exc:
                logger.exception("Tool %s failed", tool_name)
                return [types.TextContent(type="text", text=f"Error: {exc}")]

    return server
