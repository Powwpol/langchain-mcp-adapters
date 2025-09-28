import asyncio

from langchain_mcp_adapters.client import MultiServerMCPClient


async def main() -> int:
    url = "http://127.0.0.1:3010/mcp/"
    client = MultiServerMCPClient(
        {
            "math_http": {
                "transport": "streamable_http",
                "url": url,
            }
        }
    )

    print(f"Listing tools from MCP server at {url}...")
    tools = await client.get_tools(server_name="math_http")
    for tool in tools:
        print(f"- {tool.name}: {tool.description}")

    tool_names = {t.name for t in tools}
    if {"add", "multiply"}.issubset(tool_names):
        add_tool = next(t for t in tools if t.name == "add")
        multiply_tool = next(t for t in tools if t.name == "multiply")
        add_result = await add_tool.ainvoke({"a": 7, "b": 8})
        mul_result = await multiply_tool.ainvoke({"a": 6, "b": 7})
        print(f"add(7,8) -> {add_result}")
        print(f"multiply(6,7) -> {mul_result}")
        print("MCP streamable HTTP connectivity OK")
        return 0

    print("MCP connected but expected tools not found.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

