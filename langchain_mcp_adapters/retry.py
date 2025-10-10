"""Retry logic with exponential backoff for MCP operations.

This module provides retry mechanisms to handle transient failures
and improve reliability of MCP tool calls.
"""

import asyncio
import logging
from collections.abc import Callable
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class RetryConfig:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 0.1,
        max_delay: float = 10.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ) -> None:
        """Initialize retry configuration.

        Args:
            max_attempts: Maximum number of retry attempts
            initial_delay: Initial delay between retries in seconds
            max_delay: Maximum delay between retries in seconds
            exponential_base: Base for exponential backoff
            jitter: Whether to add random jitter to delay
        """
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter


async def retry_with_backoff(
    func: Callable[..., T],
    *args: Any,
    config: RetryConfig | None = None,
    **kwargs: Any,
) -> T:
    """Execute a function with exponential backoff retry logic.

    Args:
        func: Async function to execute
        *args: Positional arguments for the function
        config: Retry configuration
        **kwargs: Keyword arguments for the function

    Returns:
        Result of the function

    Raises:
        Exception: Last exception if all retries fail
    """
    if config is None:
        config = RetryConfig()

    last_exception = None

    for attempt in range(config.max_attempts):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e

            # Don't retry if this is the last attempt
            if attempt == config.max_attempts - 1:
                logger.warning(
                    "All retry attempts exhausted for %s",
                    func.__name__,
                    exc_info=True,
                )
                break

            # Calculate delay with exponential backoff
            delay = min(
                config.initial_delay * (config.exponential_base**attempt),
                config.max_delay,
            )

            # Add jitter if enabled
            if config.jitter:
                import random

                delay *= random.uniform(0.5, 1.5)

            logger.info(
                "Retry attempt %d/%d for %s after %.2fs (error: %s)",
                attempt + 1,
                config.max_attempts,
                func.__name__,
                delay,
                str(e),
            )

            await asyncio.sleep(delay)

    if last_exception is not None:
        raise last_exception

    # This should never happen, but for type safety
    msg = "Unexpected state: no result and no exception"
    raise RuntimeError(msg)
