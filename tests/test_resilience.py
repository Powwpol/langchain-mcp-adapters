"""Tests for resilience functionality."""

import asyncio

import pytest

from langchain_mcp_adapters.resilience import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerOpenError,
    CircuitState,
)


@pytest.mark.asyncio
async def test_circuit_breaker_normal_operation():
    """Test circuit breaker in normal (closed) state."""
    breaker = CircuitBreaker()

    async def successful_func():
        return "success"

    result = await breaker.call(successful_func)
    assert result == "success"
    assert breaker.get_state() == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_circuit_breaker_opens_on_failures():
    """Test that circuit breaker opens after threshold failures."""
    config = CircuitBreakerConfig(failure_threshold=3)
    breaker = CircuitBreaker(config)

    async def failing_func():
        raise ValueError("Test error")

    # Should fail but circuit stays closed
    for _ in range(2):
        with pytest.raises(ValueError):
            await breaker.call(failing_func)
        assert breaker.get_state() == CircuitState.CLOSED

    # Third failure should open the circuit
    with pytest.raises(ValueError):
        await breaker.call(failing_func)

    assert breaker.get_state() == CircuitState.OPEN


@pytest.mark.asyncio
async def test_circuit_breaker_rejects_when_open():
    """Test that circuit breaker rejects calls when open."""
    config = CircuitBreakerConfig(failure_threshold=2)
    breaker = CircuitBreaker(config)

    async def failing_func():
        raise ValueError("Test error")

    # Trigger failures to open circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            await breaker.call(failing_func)

    assert breaker.get_state() == CircuitState.OPEN

    # Next call should be rejected
    with pytest.raises(CircuitBreakerOpenError):
        await breaker.call(failing_func)


@pytest.mark.asyncio
async def test_circuit_breaker_half_open_transition():
    """Test circuit breaker transitions to half-open after timeout."""
    config = CircuitBreakerConfig(failure_threshold=2, timeout=0.1)
    breaker = CircuitBreaker(config)

    async def failing_func():
        raise ValueError("Test error")

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            await breaker.call(failing_func)

    assert breaker.get_state() == CircuitState.OPEN

    # Wait for timeout
    await asyncio.sleep(0.15)

    # Next call should transition to half-open
    async def check_state():
        return breaker.get_state()

    # The state will transition on next call
    with pytest.raises(ValueError):
        await breaker.call(failing_func)

    # After failure in half-open, should go back to open
    assert breaker.get_state() == CircuitState.OPEN


@pytest.mark.asyncio
async def test_circuit_breaker_closes_after_successes():
    """Test circuit breaker closes after threshold successes in half-open."""
    config = CircuitBreakerConfig(
        failure_threshold=2,
        success_threshold=2,
        timeout=0.1,
    )
    breaker = CircuitBreaker(config)

    async def failing_func():
        raise ValueError("Test error")

    async def successful_func():
        return "success"

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            await breaker.call(failing_func)

    # Wait for timeout to half-open
    await asyncio.sleep(0.15)

    # First success in half-open
    result = await breaker.call(successful_func)
    assert result == "success"
    assert breaker.get_state() == CircuitState.HALF_OPEN

    # Second success should close the circuit
    result = await breaker.call(successful_func)
    assert result == "success"
    assert breaker.get_state() == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_circuit_breaker_reset():
    """Test manually resetting circuit breaker."""
    config = CircuitBreakerConfig(failure_threshold=2)
    breaker = CircuitBreaker(config)

    async def failing_func():
        raise ValueError("Test error")

    # Open the circuit
    for _ in range(2):
        with pytest.raises(ValueError):
            await breaker.call(failing_func)

    assert breaker.get_state() == CircuitState.OPEN

    # Reset the circuit
    await breaker.reset()

    assert breaker.get_state() == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_circuit_breaker_timeout_in_half_open():
    """Test that circuit breaker has timeout in half-open state."""
    config = CircuitBreakerConfig(
        failure_threshold=1,
        timeout=0.1,
        half_open_timeout=0.05,
    )
    breaker = CircuitBreaker(config)

    async def slow_func():
        await asyncio.sleep(0.2)
        return "success"

    async def failing_func():
        raise ValueError("Test error")

    # Open the circuit
    with pytest.raises(ValueError):
        await breaker.call(failing_func)

    # Wait for transition to half-open
    await asyncio.sleep(0.15)

    # Slow function should timeout in half-open
    with pytest.raises(asyncio.TimeoutError):
        await breaker.call(slow_func)

    # Should be back to open
    assert breaker.get_state() == CircuitState.OPEN
