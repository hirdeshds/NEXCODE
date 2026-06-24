"""MCP Server Connector — Connect to company CI/CD infrastructure."""

import httpx


async def connect_mcp(mcp_url: str, action: str, payload: dict = None) -> dict:
    """
    Send a request to the company's MCP server.

    Args:
        mcp_url: MCP server URL (e.g. "https://mcp.company.com/sse")
        action: Action to perform (e.g. "deploy", "status", "scan")
        payload: Data to send with the request

    Returns:
        dict with response from MCP server
    """

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                mcp_url,
                json={
                    "action": action,
                    "payload": payload or {},
                },
            )
            response.raise_for_status()
            return {
                "status": "success",
                "data": response.json(),
            }

    except httpx.TimeoutException:
        return {
            "status": "error",
            "error": "MCP server timed out",
        }

    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "error": f"MCP server returned {e.response.status_code}",
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


async def check_mcp_health(mcp_url: str) -> bool:
    """Check if the MCP server is reachable."""

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(mcp_url)
            return response.status_code == 200
    except Exception:
        return False
