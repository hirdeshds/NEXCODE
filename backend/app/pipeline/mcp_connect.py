"""MCP Server Connector — Connect to company CI/CD infrastructure."""

import httpx


async def connect_mcp(mcp_url: str, action: str, payload: dict = None, headers: dict = None, timeout: int = 30) -> dict:
    """
    Send a request to the company's MCP server.

    Args:
        mcp_url: MCP server URL (e.g. "https://mcp.company.com/sse")
        action: Action to perform (e.g. "deploy", "status", "scan")
        payload: Data to send with the request
        headers: Optional HTTP headers
        timeout: Request timeout in seconds

    Returns:
        dict with response from MCP server
    """

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                mcp_url,
                json={
                    "action": action,
                    "payload": payload or {},
                },
                headers=headers,
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


async def check_mcp_health(mcp_url: str = None, timeout: int = 10, headers: dict = None) -> dict:
    """
    Check if the MCP server is reachable.
    
    If mcp_url is not provided, it attempts to load config from nexcode.config.json.
    """
    if not mcp_url:
        from app.config import get_nexcode_config
        config = get_nexcode_config()
        mcp_config = config.get("mcp", {})
        mcp_url = mcp_config.get("base_url")
        timeout = mcp_config.get("timeout_seconds", timeout)
        headers = mcp_config.get("headers", headers or {})

    if not mcp_url:
        return {
            "reachable": False,
            "status": "error",
            "error": "MCP server URL not configured"
        }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(mcp_url, headers=headers)
            if response.status_code == 200:
                return {
                    "reachable": True,
                    "status": "ok"
                }
            else:
                return {
                    "reachable": False,
                    "status": "error",
                    "error": f"MCP server returned status code {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "reachable": False,
            "status": "error",
            "error": "MCP server timed out"
        }
    except Exception as e:
        return {
            "reachable": False,
            "status": "error",
            "error": str(e)
        }

