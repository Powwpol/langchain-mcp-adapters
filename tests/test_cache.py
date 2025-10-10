"""Tests for caching functionality."""

import time

from langchain_mcp_adapters.cache import ToolCache


def test_cache_basic_operations():
    """Test basic cache operations."""
    cache = ToolCache(max_size=2, ttl_seconds=1.0)

    # Test cache miss
    result = cache.get("tool1", {"arg": 1})
    assert result is None

    # Test cache set and hit
    cache.set("tool1", {"arg": 1}, "result1")
    result = cache.get("tool1", {"arg": 1})
    assert result == "result1"

    # Test cache with different args
    result = cache.get("tool1", {"arg": 2})
    assert result is None


def test_cache_ttl_expiration():
    """Test that cache entries expire after TTL."""
    cache = ToolCache(max_size=10, ttl_seconds=0.1)

    cache.set("tool1", {"arg": 1}, "result1")

    # Should be cached immediately
    result = cache.get("tool1", {"arg": 1})
    assert result == "result1"

    # Wait for expiration
    time.sleep(0.2)

    # Should be expired
    result = cache.get("tool1", {"arg": 1})
    assert result is None


def test_cache_max_size():
    """Test that cache respects max size."""
    cache = ToolCache(max_size=2, ttl_seconds=10.0)

    cache.set("tool1", {"arg": 1}, "result1")
    cache.set("tool2", {"arg": 1}, "result2")
    cache.set("tool3", {"arg": 1}, "result3")

    # First entry should be evicted
    result = cache.get("tool1", {"arg": 1})
    assert result is None

    # Other entries should be present
    assert cache.get("tool2", {"arg": 1}) == "result2"
    assert cache.get("tool3", {"arg": 1}) == "result3"


def test_cache_lru_behavior():
    """Test LRU eviction behavior."""
    cache = ToolCache(max_size=2, ttl_seconds=10.0)

    cache.set("tool1", {"arg": 1}, "result1")
    cache.set("tool2", {"arg": 1}, "result2")

    # Access tool1 to make it most recently used
    cache.get("tool1", {"arg": 1})

    # Add new entry, should evict tool2 (least recently used)
    cache.set("tool3", {"arg": 1}, "result3")

    assert cache.get("tool1", {"arg": 1}) == "result1"
    assert cache.get("tool2", {"arg": 1}) is None
    assert cache.get("tool3", {"arg": 1}) == "result3"


def test_cache_stats():
    """Test cache statistics."""
    cache = ToolCache(max_size=10, ttl_seconds=10.0)

    cache.set("tool1", {"arg": 1}, "result1")

    # Generate hits and misses
    cache.get("tool1", {"arg": 1})  # hit
    cache.get("tool1", {"arg": 1})  # hit
    cache.get("tool2", {"arg": 1})  # miss

    stats = cache.get_stats()
    assert stats["hits"] == 2
    assert stats["misses"] == 1
    assert stats["size"] == 1
    assert stats["max_size"] == 10
    assert stats["hit_rate"] == 2 / 3


def test_cache_clear():
    """Test clearing cache."""
    cache = ToolCache(max_size=10, ttl_seconds=10.0)

    cache.set("tool1", {"arg": 1}, "result1")
    cache.set("tool2", {"arg": 1}, "result2")

    cache.clear()

    assert cache.get("tool1", {"arg": 1}) is None
    assert cache.get("tool2", {"arg": 1}) is None

    stats = cache.get_stats()
    assert stats["size"] == 0
    assert stats["hits"] == 0
    assert stats["misses"] == 2  # From the get calls above


def test_cache_key_consistency():
    """Test that cache keys are consistent for same args in different order."""
    cache = ToolCache()

    # Same arguments in different order should produce same result
    cache.set("tool1", {"a": 1, "b": 2}, "result1")
    result = cache.get("tool1", {"b": 2, "a": 1})
    assert result == "result1"
