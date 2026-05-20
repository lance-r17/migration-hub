import json
import logging
from typing import Any, Awaitable, Callable

import mcp.types as types

logger = logging.getLogger(__name__)

ToolHandler = Callable[[dict[str, Any], "McpContext"], Awaitable[Any]]  # type: ignore[name-defined]


class ToolRegistry:
    """Registry for MCP tools and their handlers."""

    def __init__(self) -> None:
        self._tools: list[types.Tool] = []
        self._handlers: dict[str, ToolHandler] = {}

    def register(self, tool: types.Tool, handler: ToolHandler) -> None:
        self._tools.append(tool)
        self._handlers[tool.name] = handler

    def get_tools(self) -> list[types.Tool]:
        return list(self._tools)

    async def call(self, name: str, arguments: dict[str, Any], ctx: "McpContext") -> Any:  # type: ignore[name-defined]
        handler = self._handlers.get(name)
        if handler is None:
            raise ValueError(f"Unknown tool: {name}")
        return await handler(arguments, ctx)


# Module-level registry — tool modules import ``register_tool`` and populate this at import time.
_registry = ToolRegistry()


def register_tool(
    name: str, description: str, input_schema: dict[str, Any]
) -> Callable[[ToolHandler], ToolHandler]:
    """Decorator to register an MCP tool."""
    tool = types.Tool(name=name, description=description, inputSchema=input_schema)

    def decorator(handler: ToolHandler) -> ToolHandler:
        _registry.register(tool, handler)
        return handler

    return decorator


def _serialize_result(result: Any) -> list[types.TextContent]:
    """Serialize a tool handler result into MCP TextContent."""
    if isinstance(result, list):
        text = json.dumps(result, indent=2, default=str)
    elif isinstance(result, dict):
        text = json.dumps(result, indent=2, default=str)
    elif isinstance(result, str):
        text = result
    else:
        text = str(result)
    return [types.TextContent(type="text", text=text)]
