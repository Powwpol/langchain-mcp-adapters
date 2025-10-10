import asyncio
import json
import os
import time
from statistics import mean
from typing import Any

from langchain_mcp_adapters.sessions import create_session
from langchain_mcp_adapters.tools import load_mcp_tools


async def run_once(connection: dict[str, Any]) -> float:
    start = time.perf_counter()
    async with create_session(connection) as session:
        await session.initialize()
        tools = await load_mcp_tools(session)
        # Call each tool with minimal valid input if possible
        for tool in tools:
            try:
                # naive default args: 0 for ints, empty for strings
                schema = tool.args_schema
                args = {}
                for k, field in getattr(tool.tool_call_schema, "model_fields", {}).items():
                    ann = field.annotation
                    if ann is int:
                        args[k] = 0
                    elif ann is float:
                        args[k] = 0.0
                    elif ann is bool:
                        args[k] = False
                    else:
                        args[k] = ""
                await tool.ainvoke(args or {"args": ""})
            except Exception:
                # swallow errors for tools requiring complex inputs
                pass
    return time.perf_counter() - start


async def main() -> None:
    config_path = os.environ.get("MCP_BENCHMARK_CONFIG", "examples/mcp_connections.json")
    with open(config_path, "r", encoding="utf-8") as f:
        connections = json.load(f)

    iterations = int(os.environ.get("MCP_BENCHMARK_ITERS", "5"))
    timings: list[float] = []

    # Benchmark each server independently
    for name, conn in connections.items():
        server_timings: list[float] = []
        for _ in range(iterations):
            server_timings.append(await run_once(conn))
        timings.extend(server_timings)
        print(f"{name}: min={min(server_timings):.3f}s avg={mean(server_timings):.3f}s max={max(server_timings):.3f}s over {iterations} iters")

    if timings:
        print(f"overall: min={min(timings):.3f}s avg={mean(timings):.3f}s max={max(timings):.3f}s over {len(timings)} runs")


if __name__ == "__main__":
    asyncio.run(main())
