"""Command-line interface for running a high-performance LangChain MCP agent.

This CLI focuses on practical performance:
- Reuses persistent MCP sessions per server to avoid per-call handshakes
- Supports optimized HTTPX client pooling for HTTP-based transports
- Streams model output when supported by the installed model provider

Optional dependencies (not installed by default):
- langgraph
- langchain (or langchain-openai / langchain-anthropic)

Install suggestions:
  pip install "langgraph>=0.2" "langchain[openai]"
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any, Callable


def _load_connections_from_file(path: str) -> dict[str, dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _maybe_make_httpx_client_factory(
    enabled: bool,
    *,
    max_connections: int,
    max_keepalive_connections: int,
    http2: bool,
) -> Callable[..., Any] | None:
    if not enabled:
        return None

    try:
        import httpx  # pragma: no cover - optional path
    except Exception:
        return None

    def factory(
        headers: dict[str, str] | None = None,
        timeout: "httpx.Timeout" | None = None,
        auth: "httpx.Auth" | None = None,
    ) -> "httpx.AsyncClient":
        return httpx.AsyncClient(
            headers=headers,
            timeout=timeout or httpx.Timeout(30.0, connect=30.0, read=30.0),
            auth=auth,
            limits=httpx.Limits(
                max_connections=max_connections,
                max_keepalive_connections=max_keepalive_connections,
            ),
            http2=http2,
        )

    return factory


async def _create_model(model_name: str):  # noqa: ANN201
    # Try the generic init_chat_model first (works with provider prefixes)
    try:
        from langchain.chat_models import init_chat_model  # type: ignore

        return init_chat_model(model_name)
    except Exception:
        pass

    # Try OpenAI provider fallback
    try:
        from langchain_openai import ChatOpenAI  # type: ignore

        return ChatOpenAI(model=model_name, streaming=True)
    except Exception as exc:  # pragma: no cover - optional path
        raise RuntimeError(
            "No chat model provider available. Install one, e.g.:\n"
            "  pip install 'langgraph>=0.2' 'langchain[openai]'\n"
            "And set OPENAI_API_KEY in the environment."
        ) from exc


async def _load_bound_tools(
    connections: dict[str, dict[str, Any]],
    *,
    optimize_httpx: bool,
    max_connections: int,
    max_keepalive_connections: int,
    http2: bool,
):  # noqa: ANN201
    from langchain_mcp_adapters.sessions import create_session
    from langchain_mcp_adapters.tools import load_mcp_tools

    httpx_factory = _maybe_make_httpx_client_factory(
        optimize_httpx,
        max_connections=max_connections,
        max_keepalive_connections=max_keepalive_connections,
        http2=http2,
    )

    bound_tools = []
    # Open and initialize a session per server, bind tools to that session for speed
    for server_name, cfg in connections.items():
        cfg = dict(cfg)  # shallow copy to avoid mutating input
        transport = cfg.get("transport")
        if httpx_factory is not None and transport in {"sse", "streamable_http"}:
            cfg["httpx_client_factory"] = httpx_factory

        async with create_session(cfg) as session:
            await session.initialize()
            tools = await load_mcp_tools(session)
            bound_tools.extend(tools)

    return bound_tools


async def _run_once(model_name: str, connections: dict[str, dict[str, Any]], message: str, args: argparse.Namespace) -> None:
    # Defer heavy imports until CLI is actually used
    from langgraph.prebuilt import create_react_agent  # type: ignore

    model = await _create_model(model_name)
    tools = await _load_bound_tools(
        connections,
        optimize_httpx=args.optimize_httpx,
        max_connections=args.max_connections,
        max_keepalive_connections=args.max_keepalive_connections,
        http2=not args.disable_http2,
    )

    agent = create_react_agent(model, tools)

    if args.stream:
        async for event in agent.astream_events({"messages": message}, version="v2"):
            if event["event"] == "on_chat_model_stream" and "chunk" in event["data"]:
                # print incremental chunks to stdout
                chunk = event["data"]["chunk"]
                if hasattr(chunk, "content") and chunk.content:
                    text = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
                    sys.stdout.write(text)
                    sys.stdout.flush()
        print()
    else:
        result = await agent.ainvoke({"messages": message})
        print(result)


async def _run_repl(model_name: str, connections: dict[str, dict[str, Any]], args: argparse.Namespace) -> None:
    # Defer heavy imports until CLI is actually used
    from langgraph.prebuilt import create_react_agent  # type: ignore

    model = await _create_model(model_name)
    tools = await _load_bound_tools(
        connections,
        optimize_httpx=args.optimize_httpx,
        max_connections=args.max_connections,
        max_keepalive_connections=args.max_keepalive_connections,
        http2=not args.disable_http2,
    )
    agent = create_react_agent(model, tools)

    print("Type 'exit' or Ctrl+C to quit.")
    while True:
        try:
            prompt = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if prompt.lower() in {"exit", "quit"}:
            break

        if args.stream:
            async for event in agent.astream_events({"messages": prompt}, version="v2"):
                if event["event"] == "on_chat_model_stream" and "chunk" in event["data"]:
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        text = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
                        sys.stdout.write(text)
                        sys.stdout.flush()
            print()
        else:
            result = await agent.ainvoke({"messages": prompt})
            print(result)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a high-performance LangChain MCP agent")
    parser.add_argument("--config", type=str, required=False, help="Path to JSON file of MCP connections")
    parser.add_argument("--model", type=str, default=os.environ.get("MCP_AGENT_MODEL", "openai:gpt-4o-mini"), help="Model identifier for LangChain. Example: openai:gpt-4o-mini")
    parser.add_argument("--message", type=str, help="Run a single message and exit")
    parser.add_argument("--stream", action="store_true", help="Stream model output when supported")
    parser.add_argument("--repl", action="store_true", help="Run interactive REPL mode instead of single message")
    parser.add_argument("--optimize-httpx", action="store_true", help="Use optimized HTTPX client pooling for HTTP transports")
    parser.add_argument("--max-connections", type=int, default=50, help="Max concurrent HTTP connections per host")
    parser.add_argument("--max-keepalive-connections", type=int, default=20, help="Max keepalive HTTP connections per host")
    parser.add_argument("--disable-http2", action="store_true", help="Disable HTTP/2 (enabled by default if available)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv or sys.argv[1:])

    if not args.config:
        print("--config is required and must point to a JSON file with MCP connections", file=sys.stderr)
        sys.exit(2)

    try:
        connections = _load_connections_from_file(args.config)
    except Exception as exc:
        print(f"Failed to load connections from {args.config}: {exc}", file=sys.stderr)
        sys.exit(2)

    if args.repl or not args.message:
        asyncio.run(_run_repl(args.model, connections, args))
    else:
        asyncio.run(_run_once(args.model, connections, args.message, args))


if __name__ == "__main__":  # pragma: no cover
    main()
