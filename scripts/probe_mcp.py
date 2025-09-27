import asyncio
import os
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient


async def main() -> int:
    tests_dir = Path(__file__).resolve().parents[1] / "tests" / "servers"
    math_server_path = str(tests_dir / "math_server.py")

    if not os.path.exists(math_server_path):
        print(f"Math server not found at: {math_server_path}")
        return 2

    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": "python3",
                "args": [math_server_path],
            }
        }
    )

    print("Listing tools from MCP 'math' server...")
    tools = await client.get_tools(server_name="math")
    for tool in tools:
        print(f"- {tool.name}: {tool.description}")

    # Try calling tools if present
    tool_names = {t.name for t in tools}
    if {"add", "multiply"}.issubset(tool_names):
        add_tool = next(t for t in tools if t.name == "add")
        multiply_tool = next(t for t in tools if t.name == "multiply")
        add_result = await add_tool.ainvoke({"a": 2, "b": 3})
        mul_result = await multiply_tool.ainvoke({"a": 4, "b": 5})
        print(f"add(2,3) -> {add_result}")
        print(f"multiply(4,5) -> {mul_result}")
        print("MCP connectivity OK")
        return 0

    print("MCP connected but expected tools not found.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

