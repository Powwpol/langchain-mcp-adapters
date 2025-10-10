"""Client for connecting to multiple MCP servers and loading LangChain tools/resources.

This module provides the MultiServerMCPClient class for managing connections to multiple
MCP servers and loading tools, prompts, and resources from them.
"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import TracebackType
from typing import Any

from langchain_core.documents.base import Blob
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import BaseTool
from mcp import ClientSession

from langchain_mcp_adapters.cache import ToolCache
from langchain_mcp_adapters.metrics import MetricsCollector
from langchain_mcp_adapters.prompts import load_mcp_prompt
from langchain_mcp_adapters.resilience import CircuitBreaker, CircuitBreakerConfig
from langchain_mcp_adapters.resources import load_mcp_resources
from langchain_mcp_adapters.retry import RetryConfig
from langchain_mcp_adapters.sessions import (
    Connection,
    McpHttpClientFactory,
    SSEConnection,
    StdioConnection,
    StreamableHttpConnection,
    WebsocketConnection,
    create_session,
)
from langchain_mcp_adapters.tools import load_mcp_tools

ASYNC_CONTEXT_MANAGER_ERROR = (
    "As of langchain-mcp-adapters 0.1.0, MultiServerMCPClient cannot be used as a "
    "context manager (e.g., async with MultiServerMCPClient(...)). "
    "Instead, you can do one of the following:\n"
    "1. client = MultiServerMCPClient(...)\n"
    "   tools = await client.get_tools()\n"
    "2. client = MultiServerMCPClient(...)\n"
    "   async with client.session(server_name) as session:\n"
    "       tools = await load_mcp_tools(session)"
)


class MultiServerMCPClient:
    """Client for connecting to multiple MCP servers.

    Loads LangChain-compatible tools, prompts and resources from MCP servers.
    """

    def __init__(
        self,
        connections: dict[str, Connection] | None = None,
        *,
        enable_cache: bool = True,
        cache_max_size: int = 1000,
        cache_ttl_seconds: float = 300.0,
        enable_metrics: bool = True,
        enable_circuit_breaker: bool = True,
        circuit_breaker_config: CircuitBreakerConfig | None = None,
        retry_config: RetryConfig | None = None,
    ) -> None:
        """Initialize a MultiServerMCPClient with MCP servers connections.

        Args:
            connections: A dictionary mapping server names to connection configurations.
                If None, no initial connections are established.
            enable_cache: Whether to enable result caching (default: True)
            cache_max_size: Maximum cache size (default: 1000)
            cache_ttl_seconds: Cache TTL in seconds (default: 300)
            enable_metrics: Whether to enable metrics collection (default: True)
            enable_circuit_breaker: Whether to enable circuit breaker (default: True)
            circuit_breaker_config: Custom circuit breaker configuration
            retry_config: Custom retry configuration

        Example: basic usage (starting a new session on each tool call)

        ```python
        from langchain_mcp_adapters.client import MultiServerMCPClient

        client = MultiServerMCPClient(
            {
                "math": {
                    "command": "python",
                    # Make sure to update to the full absolute path to your
                    # math_server.py file
                    "args": ["/path/to/math_server.py"],
                    "transport": "stdio",
                },
                "weather": {
                    # Make sure you start your weather server on port 8000
                    "url": "http://localhost:8000/mcp",
                    "transport": "streamable_http",
                }
            }
        )
        all_tools = await client.get_tools()
        ```

        Example: explicitly starting a session

        ```python
        from langchain_mcp_adapters.client import MultiServerMCPClient
        from langchain_mcp_adapters.tools import load_mcp_tools

        client = MultiServerMCPClient({...})
        async with client.session("math") as session:
            tools = await load_mcp_tools(session)
        ```

        """
        self.connections: dict[str, Connection] = (
            connections if connections is not None else {}
        )

        # Initialize performance and resilience features
        self.cache: ToolCache | None = (
            ToolCache(max_size=cache_max_size, ttl_seconds=cache_ttl_seconds)
            if enable_cache
            else None
        )
        self.metrics: MetricsCollector | None = (
            MetricsCollector() if enable_metrics else None
        )
        self.circuit_breaker: CircuitBreaker | None = (
            CircuitBreaker(circuit_breaker_config) if enable_circuit_breaker else None
        )
        self.retry_config = retry_config

    @asynccontextmanager
    async def session(
        self,
        server_name: str,
        *,
        auto_initialize: bool = True,
    ) -> AsyncIterator[ClientSession]:
        """Connect to an MCP server and initialize a session.

        Args:
            server_name: Name to identify this server connection
            auto_initialize: Whether to automatically initialize the session

        Raises:
            ValueError: If the server name is not found in the connections

        Yields:
            An initialized ClientSession

        """
        if server_name not in self.connections:
            msg = (
                f"Couldn't find a server with name '{server_name}', "
                f"expected one of '{list(self.connections.keys())}'"
            )
            raise ValueError(msg)

        async with create_session(self.connections[server_name]) as session:
            if auto_initialize:
                await session.initialize()
            yield session

    async def get_tools(self, *, server_name: str | None = None) -> list[BaseTool]:
        """Get a list of all tools from all connected servers.

        Args:
            server_name: Optional name of the server to get tools from.
                If None, all tools from all servers will be returned (default).

        NOTE: a new session will be created for each tool call

        Returns:
            A list of LangChain tools

        """
        if server_name is not None:
            if server_name not in self.connections:
                msg = (
                    f"Couldn't find a server with name '{server_name}', "
                    f"expected one of '{list(self.connections.keys())}'"
                )
                raise ValueError(msg)
            return await load_mcp_tools(
                None,
                connection=self.connections[server_name],
                cache=self.cache,
                metrics=self.metrics,
                circuit_breaker=self.circuit_breaker,
                retry_config=self.retry_config,
            )

        all_tools: list[BaseTool] = []
        load_mcp_tool_tasks = []
        for connection in self.connections.values():
            load_mcp_tool_task = asyncio.create_task(
                load_mcp_tools(
                    None,
                    connection=connection,
                    cache=self.cache,
                    metrics=self.metrics,
                    circuit_breaker=self.circuit_breaker,
                    retry_config=self.retry_config,
                )
            )
            load_mcp_tool_tasks.append(load_mcp_tool_task)
        tools_list = await asyncio.gather(*load_mcp_tool_tasks)
        for tools in tools_list:
            all_tools.extend(tools)
        return all_tools

    async def get_prompt(
        self,
        server_name: str,
        prompt_name: str,
        *,
        arguments: dict[str, Any] | None = None,
    ) -> list[HumanMessage | AIMessage]:
        """Get a prompt from a given MCP server."""
        async with self.session(server_name) as session:
            return await load_mcp_prompt(session, prompt_name, arguments=arguments)

    async def get_resources(
        self,
        server_name: str,
        *,
        uris: str | list[str] | None = None,
    ) -> list[Blob]:
        """Get resources from a given MCP server.

        Args:
            server_name: Name of the server to get resources from
            uris: Optional resource URI or list of URIs to load. If not provided,
                all resources will be loaded.

        Returns:
            A list of LangChain Blobs

        """
        async with self.session(server_name) as session:
            return await load_mcp_resources(session, uris=uris)

    async def __aenter__(self) -> "MultiServerMCPClient":
        """Async context manager entry point.

        Raises:
            NotImplementedError: Context manager support has been removed.
        """
        raise NotImplementedError(ASYNC_CONTEXT_MANAGER_ERROR)

    def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Async context manager exit point.

        Args:
            exc_type: Exception type if an exception occurred.
            exc_val: Exception value if an exception occurred.
            exc_tb: Exception traceback if an exception occurred.

        Raises:
            NotImplementedError: Context manager support has been removed.
        """
        raise NotImplementedError(ASYNC_CONTEXT_MANAGER_ERROR)

    def get_metrics(self, tool_name: str | None = None) -> dict[str, Any]:
        """Get performance metrics for tools.

        Args:
            tool_name: Optional tool name to get metrics for specific tool

        Returns:
            Dictionary of metrics
        """
        if self.metrics is None:
            return {}
        return self.metrics.get_metrics(tool_name)

    def get_cache_stats(self) -> dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary of cache statistics
        """
        if self.cache is None:
            return {}
        return self.cache.get_stats()

    def clear_cache(self) -> None:
        """Clear the tool result cache."""
        if self.cache is not None:
            self.cache.clear()

    async def reset_circuit_breaker(self) -> None:
        """Reset the circuit breaker to closed state."""
        if self.circuit_breaker is not None:
            await self.circuit_breaker.reset()


__all__ = [
    "CircuitBreakerConfig",
    "McpHttpClientFactory",
    "MetricsCollector",
    "MultiServerMCPClient",
    "RetryConfig",
    "SSEConnection",
    "StdioConnection",
    "StreamableHttpConnection",
    "ToolCache",
    "WebsocketConnection",
]
