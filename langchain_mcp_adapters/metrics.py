"""Metrics and monitoring for MCP operations.

This module provides instrumentation for tracking performance,
errors, and usage of MCP tools.
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolMetrics:
    """Metrics for a single tool."""

    call_count: int = 0
    success_count: int = 0
    error_count: int = 0
    total_latency: float = 0.0
    min_latency: float = float("inf")
    max_latency: float = 0.0
    error_types: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def record_success(self, latency: float) -> None:
        """Record a successful tool call.

        Args:
            latency: Time taken for the call in seconds
        """
        self.call_count += 1
        self.success_count += 1
        self.total_latency += latency
        self.min_latency = min(self.min_latency, latency)
        self.max_latency = max(self.max_latency, latency)

    def record_error(self, error_type: str, latency: float) -> None:
        """Record a failed tool call.

        Args:
            error_type: Type of error that occurred
            latency: Time taken before the error in seconds
        """
        self.call_count += 1
        self.error_count += 1
        self.total_latency += latency
        self.error_types[error_type] += 1

    def get_avg_latency(self) -> float:
        """Get average latency across all calls.

        Returns:
            Average latency in seconds
        """
        if self.call_count == 0:
            return 0.0
        return self.total_latency / self.call_count

    def get_success_rate(self) -> float:
        """Get success rate as a percentage.

        Returns:
            Success rate between 0.0 and 1.0
        """
        if self.call_count == 0:
            return 0.0
        return self.success_count / self.call_count


class MetricsCollector:
    """Collector for MCP tool metrics."""

    def __init__(self) -> None:
        """Initialize the metrics collector."""
        self._metrics: dict[str, ToolMetrics] = defaultdict(ToolMetrics)
        self._start_times: dict[str, float] = {}

    def start_call(self, tool_name: str, call_id: str) -> None:  # noqa: ARG002
        """Mark the start of a tool call.

        Args:
            tool_name: Name of the tool being called
            call_id: Unique identifier for this call
        """
        self._start_times[call_id] = time.time()

    def record_success(self, tool_name: str, call_id: str) -> None:
        """Record a successful tool call.

        Args:
            tool_name: Name of the tool
            call_id: Unique identifier for this call
        """
        if call_id not in self._start_times:
            return

        latency = time.time() - self._start_times[call_id]
        self._metrics[tool_name].record_success(latency)
        del self._start_times[call_id]

    def record_error(self, tool_name: str, call_id: str, error_type: str) -> None:
        """Record a failed tool call.

        Args:
            tool_name: Name of the tool
            call_id: Unique identifier for this call
            error_type: Type of error that occurred
        """
        if call_id not in self._start_times:
            return

        latency = time.time() - self._start_times[call_id]
        self._metrics[tool_name].record_error(error_type, latency)
        del self._start_times[call_id]

    def get_metrics(self, tool_name: str | None = None) -> dict[str, Any]:
        """Get metrics for a specific tool or all tools.

        Args:
            tool_name: Name of the tool, or None for all tools

        Returns:
            Dictionary of metrics
        """
        if tool_name is not None:
            if tool_name not in self._metrics:
                return {}

            metrics = self._metrics[tool_name]
            return {
                "call_count": metrics.call_count,
                "success_count": metrics.success_count,
                "error_count": metrics.error_count,
                "success_rate": metrics.get_success_rate(),
                "avg_latency_ms": metrics.get_avg_latency() * 1000,
                "min_latency_ms": metrics.min_latency * 1000
                if metrics.min_latency != float("inf")
                else 0,
                "max_latency_ms": metrics.max_latency * 1000,
                "error_types": dict(metrics.error_types),
            }

        # Return metrics for all tools
        return {
            name: {
                "call_count": m.call_count,
                "success_count": m.success_count,
                "error_count": m.error_count,
                "success_rate": m.get_success_rate(),
                "avg_latency_ms": m.get_avg_latency() * 1000,
                "min_latency_ms": m.min_latency * 1000
                if m.min_latency != float("inf")
                else 0,
                "max_latency_ms": m.max_latency * 1000,
                "error_types": dict(m.error_types),
            }
            for name, m in self._metrics.items()
        }

    def reset(self) -> None:
        """Reset all metrics."""
        self._metrics.clear()
        self._start_times.clear()
