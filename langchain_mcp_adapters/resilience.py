"""Resilience patterns for MCP operations.

This module provides circuit breaker and other resilience patterns
to prevent cascading failures and improve system stability.
"""

import asyncio
import logging
import time
from collections.abc import Callable
from enum import Enum
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    """States of a circuit breaker."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerConfig:
    """Configuration for circuit breaker behavior."""

    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: float = 60.0,
        half_open_timeout: float = 5.0,
    ) -> None:
        """Initialize circuit breaker configuration.

        Args:
            failure_threshold: Number of failures before opening circuit
            success_threshold: Number of successes in half-open to close circuit
            timeout: Time in seconds before attempting to close an open circuit
            half_open_timeout: Timeout for operations in half-open state
        """
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.half_open_timeout = half_open_timeout


class CircuitBreaker:
    """Circuit breaker for protecting against cascading failures."""

    def __init__(self, config: CircuitBreakerConfig | None = None) -> None:
        """Initialize circuit breaker.

        Args:
            config: Circuit breaker configuration
        """
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: float | None = None
        self._lock = asyncio.Lock()

    async def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Execute a function through the circuit breaker.

        Args:
            func: Async function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            Result of the function

        Raises:
            CircuitBreakerOpenError: If circuit is open
            Exception: Original exception from the function
        """
        async with self._lock:
            # Check if we should transition from OPEN to HALF_OPEN
            if (
                self.state == CircuitState.OPEN
                and self.last_failure_time is not None
                and time.time() - self.last_failure_time >= self.config.timeout
            ):
                logger.info("Circuit breaker transitioning to HALF_OPEN")
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0

            # Reject calls if circuit is OPEN
            if self.state == CircuitState.OPEN:
                msg = "Circuit breaker is OPEN"
                raise CircuitBreakerOpenError(msg)

        # Execute the function
        try:
            if self.state == CircuitState.HALF_OPEN:
                # Add timeout in half-open state
                result = await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=self.config.half_open_timeout,
                )
            else:
                result = await func(*args, **kwargs)

            # Record success
            await self._record_success()
            return result

        except Exception:
            # Record failure
            await self._record_failure()
            raise

    async def _record_success(self) -> None:
        """Record a successful call."""
        async with self._lock:
            self.failure_count = 0

            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                logger.info(
                    "Circuit breaker success in HALF_OPEN: %d/%d",
                    self.success_count,
                    self.config.success_threshold,
                )

                if self.success_count >= self.config.success_threshold:
                    logger.info("Circuit breaker transitioning to CLOSED")
                    self.state = CircuitState.CLOSED
                    self.success_count = 0

    async def _record_failure(self) -> None:
        """Record a failed call."""
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.state == CircuitState.HALF_OPEN:
                logger.warning("Circuit breaker failure in HALF_OPEN, reopening")
                self.state = CircuitState.OPEN
                self.success_count = 0

            elif self.failure_count >= self.config.failure_threshold:
                logger.warning(
                    "Circuit breaker threshold reached (%d failures), opening",
                    self.failure_count,
                )
                self.state = CircuitState.OPEN

    def get_state(self) -> CircuitState:
        """Get current circuit breaker state.

        Returns:
            Current state
        """
        return self.state

    async def reset(self) -> None:
        """Reset the circuit breaker to closed state."""
        async with self._lock:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.success_count = 0
            self.last_failure_time = None
            logger.info("Circuit breaker manually reset to CLOSED")


class CircuitBreakerOpenError(Exception):
    """Exception raised when circuit breaker is open."""

