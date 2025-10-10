"""Tests for retry functionality."""


import pytest

from langchain_mcp_adapters.retry import RetryConfig, retry_with_backoff


@pytest.mark.asyncio
async def test_retry_successful_on_first_attempt():
    """Test that retry works on first successful attempt."""
    call_count = 0

    async def successful_func():
        nonlocal call_count
        call_count += 1
        return "success"

    result = await retry_with_backoff(successful_func)
    assert result == "success"
    assert call_count == 1


@pytest.mark.asyncio
async def test_retry_succeeds_after_failures():
    """Test that retry succeeds after some failures."""
    call_count = 0

    async def eventually_successful():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ValueError("Not yet")
        return "success"

    config = RetryConfig(max_attempts=5, initial_delay=0.01)
    result = await retry_with_backoff(eventually_successful, config=config)
    assert result == "success"
    assert call_count == 3


@pytest.mark.asyncio
async def test_retry_exhausts_attempts():
    """Test that retry raises exception after max attempts."""
    call_count = 0

    async def always_fails():
        nonlocal call_count
        call_count += 1
        raise ValueError("Always fails")

    config = RetryConfig(max_attempts=3, initial_delay=0.01)

    with pytest.raises(ValueError, match="Always fails"):
        await retry_with_backoff(always_fails, config=config)

    assert call_count == 3


@pytest.mark.asyncio
async def test_retry_exponential_backoff():
    """Test that retry uses exponential backoff."""
    call_times = []

    async def failing_func():
        import time

        call_times.append(time.time())
        raise ValueError("Test error")

    config = RetryConfig(
        max_attempts=3,
        initial_delay=0.05,
        exponential_base=2.0,
        jitter=False,
    )

    with pytest.raises(ValueError):
        await retry_with_backoff(failing_func, config=config)

    assert len(call_times) == 3

    # Check delays are increasing (with some tolerance for timing)
    delay1 = call_times[1] - call_times[0]
    delay2 = call_times[2] - call_times[1]

    # Second delay should be roughly double the first
    assert delay2 > delay1


@pytest.mark.asyncio
async def test_retry_max_delay():
    """Test that retry respects max delay."""
    call_times = []

    async def failing_func():
        import time

        call_times.append(time.time())
        raise ValueError("Test error")

    config = RetryConfig(
        max_attempts=4,
        initial_delay=0.1,
        max_delay=0.15,
        exponential_base=2.0,
        jitter=False,
    )

    with pytest.raises(ValueError):
        await retry_with_backoff(failing_func, config=config)

    # Check that delays don't exceed max_delay
    for i in range(1, len(call_times)):
        delay = call_times[i] - call_times[i - 1]
        assert delay <= config.max_delay + 0.05  # Small tolerance


@pytest.mark.asyncio
async def test_retry_with_jitter():
    """Test that retry adds jitter to delays."""
    delays = []

    async def failing_func():
        raise ValueError("Test error")

    config = RetryConfig(
        max_attempts=3,
        initial_delay=0.05,
        exponential_base=2.0,
        jitter=True,
    )

    # Run multiple times to test jitter
    for _ in range(5):
        call_times = []

        async def tracking_func():
            import time

            call_times.append(time.time())
            raise ValueError("Test")

        with pytest.raises(ValueError):
            await retry_with_backoff(tracking_func, config=config)

        if len(call_times) >= 2:
            delays.append(call_times[1] - call_times[0])

    # With jitter, delays should vary
    assert len(set(delays)) > 1 or len(delays) < 2


@pytest.mark.asyncio
async def test_retry_with_arguments():
    """Test that retry passes arguments correctly."""
    call_count = 0

    async def func_with_args(a, b, c=None):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise ValueError("Not yet")
        return f"{a}-{b}-{c}"

    config = RetryConfig(max_attempts=3, initial_delay=0.01)
    result = await retry_with_backoff(func_with_args, "x", "y", c="z", config=config)

    assert result == "x-y-z"
    assert call_count == 2
