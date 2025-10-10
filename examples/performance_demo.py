"""Demonstration of langchain-mcp-adapters performance features.

This example shows how to use caching, retry, circuit breaker, and metrics.
"""

import asyncio
import time

from langchain_mcp_adapters import (
    CircuitBreakerConfig,
    MultiServerMCPClient,
    RetryConfig,
)


async def basic_example():
    """Basic example with default performance features."""
    print("=== Basic Example ===\n")
    
    # All performance features are enabled by default!
    client = MultiServerMCPClient(
        {
            "math": {
                "command": "python",
                "args": ["-m", "tests.servers.math_server"],
                "transport": "stdio",
            }
        }
    )
    
    tools = await client.get_tools()
    print(f"Loaded {len(tools)} tools")
    
    # Simulate using a tool
    for tool in tools:
        print(f"  - {tool.name}: {tool.description}")
    
    # Get metrics
    metrics = client.get_metrics()
    print(f"\nMetrics: {metrics}")
    
    # Get cache stats
    cache_stats = client.get_cache_stats()
    print(f"Cache stats: {cache_stats}\n")


async def custom_config_example():
    """Example with custom configuration."""
    print("=== Custom Configuration Example ===\n")
    
    client = MultiServerMCPClient(
        {
            "math": {
                "command": "python",
                "args": ["-m", "tests.servers.math_server"],
                "transport": "stdio",
            }
        },
        # Custom cache settings
        enable_cache=True,
        cache_max_size=5000,
        cache_ttl_seconds=600.0,  # 10 minutes
        
        # Enable metrics
        enable_metrics=True,
        
        # Custom circuit breaker
        enable_circuit_breaker=True,
        circuit_breaker_config=CircuitBreakerConfig(
            failure_threshold=5,
            success_threshold=2,
            timeout=60.0,
        ),
        
        # Custom retry config
        retry_config=RetryConfig(
            max_attempts=3,
            initial_delay=0.1,
            max_delay=10.0,
            exponential_base=2.0,
            jitter=True,
        ),
    )
    
    tools = await client.get_tools()
    print(f"Loaded {len(tools)} tools with custom config\n")


async def caching_demo():
    """Demonstrate caching benefits."""
    print("=== Caching Demo ===\n")
    
    client = MultiServerMCPClient(
        {
            "math": {
                "command": "python",
                "args": ["-m", "tests.servers.math_server"],
                "transport": "stdio",
            }
        },
        cache_max_size=100,
        cache_ttl_seconds=60.0,
    )
    
    tools = await client.get_tools()
    add_tool = next(t for t in tools if t.name == "add")
    
    # First call - cache miss
    start = time.time()
    result1 = await add_tool.ainvoke({
        "args": {"a": 5, "b": 3},
        "id": "1",
        "type": "tool_call"
    })
    time1 = (time.time() - start) * 1000
    
    # Second call - cache HIT!
    start = time.time()
    result2 = await add_tool.ainvoke({
        "args": {"a": 5, "b": 3},
        "id": "2",
        "type": "tool_call"
    })
    time2 = (time.time() - start) * 1000
    
    print(f"First call (cache miss): {time1:.2f}ms")
    print(f"Second call (cache hit): {time2:.2f}ms")
    print(f"Speedup: {time1/time2:.1f}x faster!")
    
    cache_stats = client.get_cache_stats()
    print(f"\nCache stats: {cache_stats}")
    print(f"Hit rate: {cache_stats['hit_rate']:.1%}\n")


async def metrics_demo():
    """Demonstrate metrics collection."""
    print("=== Metrics Demo ===\n")
    
    client = MultiServerMCPClient(
        {
            "math": {
                "command": "python",
                "args": ["-m", "tests.servers.math_server"],
                "transport": "stdio",
            }
        },
        enable_metrics=True,
    )
    
    tools = await client.get_tools()
    add_tool = next(t for t in tools if t.name == "add")
    
    # Make several calls
    for i in range(5):
        await add_tool.ainvoke({
            "args": {"a": i, "b": i + 1},
            "id": str(i),
            "type": "tool_call"
        })
    
    # Get metrics for specific tool
    add_metrics = client.get_metrics("add")
    print(f"Metrics for 'add' tool:")
    print(f"  Calls: {add_metrics['call_count']}")
    print(f"  Success rate: {add_metrics['success_rate']:.1%}")
    print(f"  Avg latency: {add_metrics['avg_latency_ms']:.2f}ms")
    print(f"  Min latency: {add_metrics['min_latency_ms']:.2f}ms")
    print(f"  Max latency: {add_metrics['max_latency_ms']:.2f}ms")
    
    # Get all metrics
    all_metrics = client.get_metrics()
    print(f"\nAll tools metrics:")
    for tool_name, metrics in all_metrics.items():
        print(f"  {tool_name}: {metrics['call_count']} calls, "
              f"{metrics['success_rate']:.1%} success rate\n")


async def selective_features_example():
    """Example of enabling only specific features."""
    print("=== Selective Features Example ===\n")
    
    # Only cache and metrics, no circuit breaker or retry
    client = MultiServerMCPClient(
        {
            "math": {
                "command": "python",
                "args": ["-m", "tests.servers.math_server"],
                "transport": "stdio",
            }
        },
        enable_cache=True,
        enable_metrics=True,
        enable_circuit_breaker=False,  # Disabled
        retry_config=None,  # Disabled
    )
    
    tools = await client.get_tools()
    print(f"Loaded {len(tools)} tools (cache + metrics only)\n")


async def main():
    """Run all examples."""
    print("=" * 60)
    print("LangChain MCP Adapters - Performance Features Demo")
    print("=" * 60 + "\n")
    
    try:
        await basic_example()
        await custom_config_example()
        await caching_demo()
        await metrics_demo()
        await selective_features_example()
        
        print("=" * 60)
        print("Demo completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nError running demo: {e}")
        print("\nNote: This demo requires test servers to be available.")
        print("Run from the project root with: python examples/performance_demo.py")


if __name__ == "__main__":
    asyncio.run(main())
