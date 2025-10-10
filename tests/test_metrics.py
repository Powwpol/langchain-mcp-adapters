"""Tests for metrics functionality."""


from langchain_mcp_adapters.metrics import MetricsCollector


def test_metrics_basic_operations():
    """Test basic metrics operations."""
    collector = MetricsCollector()

    collector.start_call("tool1", "call1")
    collector.record_success("tool1", "call1")

    metrics = collector.get_metrics("tool1")
    assert metrics["call_count"] == 1
    assert metrics["success_count"] == 1
    assert metrics["error_count"] == 0
    assert metrics["success_rate"] == 1.0


def test_metrics_error_recording():
    """Test error recording in metrics."""
    collector = MetricsCollector()

    collector.start_call("tool1", "call1")
    collector.record_error("tool1", "call1", "ValueError")

    metrics = collector.get_metrics("tool1")
    assert metrics["call_count"] == 1
    assert metrics["success_count"] == 0
    assert metrics["error_count"] == 1
    assert metrics["success_rate"] == 0.0
    assert metrics["error_types"]["ValueError"] == 1


def test_metrics_multiple_calls():
    """Test metrics with multiple calls."""
    collector = MetricsCollector()

    # Record multiple successes
    for i in range(3):
        collector.start_call("tool1", f"call{i}")
        collector.record_success("tool1", f"call{i}")

    # Record some errors
    for i in range(2):
        collector.start_call("tool1", f"error_call{i}")
        collector.record_error("tool1", f"error_call{i}", "RuntimeError")

    metrics = collector.get_metrics("tool1")
    assert metrics["call_count"] == 5
    assert metrics["success_count"] == 3
    assert metrics["error_count"] == 2
    assert metrics["success_rate"] == 0.6


def test_metrics_latency_tracking():
    """Test latency tracking in metrics."""
    import time

    collector = MetricsCollector()

    collector.start_call("tool1", "call1")
    time.sleep(0.01)  # Simulate work
    collector.record_success("tool1", "call1")

    metrics = collector.get_metrics("tool1")
    assert metrics["avg_latency_ms"] > 0
    assert metrics["min_latency_ms"] > 0
    assert metrics["max_latency_ms"] > 0


def test_metrics_multiple_tools():
    """Test metrics for multiple tools."""
    collector = MetricsCollector()

    collector.start_call("tool1", "call1")
    collector.record_success("tool1", "call1")

    collector.start_call("tool2", "call2")
    collector.record_success("tool2", "call2")

    # Get all metrics
    all_metrics = collector.get_metrics()
    assert "tool1" in all_metrics
    assert "tool2" in all_metrics
    assert all_metrics["tool1"]["call_count"] == 1
    assert all_metrics["tool2"]["call_count"] == 1


def test_metrics_error_types():
    """Test tracking of different error types."""
    collector = MetricsCollector()

    collector.start_call("tool1", "call1")
    collector.record_error("tool1", "call1", "ValueError")

    collector.start_call("tool1", "call2")
    collector.record_error("tool1", "call2", "TypeError")

    collector.start_call("tool1", "call3")
    collector.record_error("tool1", "call3", "ValueError")

    metrics = collector.get_metrics("tool1")
    assert metrics["error_types"]["ValueError"] == 2
    assert metrics["error_types"]["TypeError"] == 1


def test_metrics_reset():
    """Test resetting metrics."""
    collector = MetricsCollector()

    collector.start_call("tool1", "call1")
    collector.record_success("tool1", "call1")

    collector.reset()

    metrics = collector.get_metrics("tool1")
    assert metrics == {}


def test_metrics_unknown_tool():
    """Test getting metrics for unknown tool."""
    collector = MetricsCollector()

    metrics = collector.get_metrics("unknown_tool")
    assert metrics == {}
