"""Launcher script for Threshold backend server.
Sets WindowsProactorEventLoopPolicy BEFORE Uvicorn initializes its event loop,
preventing Playwright 'NotImplementedError' on Windows.
"""
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    print("[SERVER] Starting Threshold backend server with Windows Proactor event loop...")
    uvicorn.run("web.api:app", host="127.0.0.1", port=8000, reload=True, loop="asyncio")
