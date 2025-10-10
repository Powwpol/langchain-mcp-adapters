"""Caching support for MCP tools to improve performance.

This module provides caching mechanisms to reduce latency and server load
by storing results of frequently called tools.
"""

import hashlib
import json
import time
from collections import OrderedDict
from typing import Any


class ToolCache:
    """LRU cache for MCP tool results with TTL support."""

    def __init__(self, max_size: int = 1000, ttl_seconds: float = 300.0) -> None:
        """Initialize the tool cache.

        Args:
            max_size: Maximum number of entries to store in cache
            ttl_seconds: Time-to-live for cache entries in seconds
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._hits = 0
        self._misses = 0

    def _make_key(self, tool_name: str, arguments: dict[str, Any]) -> str:
        """Create a cache key from tool name and arguments.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments

        Returns:
            A hash key for the cache
        """
        # Sort arguments for consistent hashing
        sorted_args = json.dumps(arguments, sort_keys=True)
        key_str = f"{tool_name}:{sorted_args}"
        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, tool_name: str, arguments: dict[str, Any]) -> Any | None:
        """Get a cached result if available and not expired.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments

        Returns:
            Cached result or None if not found or expired
        """
        key = self._make_key(tool_name, arguments)

        if key not in self._cache:
            self._misses += 1
            return None

        result, timestamp = self._cache[key]

        # Check if expired
        if time.time() - timestamp > self.ttl_seconds:
            del self._cache[key]
            self._misses += 1
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        self._hits += 1
        return result

    def set(self, tool_name: str, arguments: dict[str, Any], result: Any) -> None:
        """Store a result in the cache.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments
            result: Result to cache
        """
        key = self._make_key(tool_name, arguments)

        # Remove oldest entry if at capacity
        if len(self._cache) >= self.max_size and key not in self._cache:
            self._cache.popitem(last=False)

        self._cache[key] = (result, time.time())
        self._cache.move_to_end(key)

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()
        self._hits = 0
        self._misses = 0

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0.0

        return {
            "hits": self._hits,
            "misses": self._misses,
            "size": len(self._cache),
            "max_size": self.max_size,
            "hit_rate": hit_rate,
        }
