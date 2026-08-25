import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from web.routes import router

app = FastAPI(
    title="Threshold Backend",
    description="SRM Academia scraper backend for the Threshold companion app",
    version="0.1.0",
)

origins = [
    o.strip()
    for o in settings.cors_origins.split(",")
    if o.strip() and o.strip().startswith("http")
]
print(f"[CORS] Allowed origins: {origins}")

local_defaults = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "https://localhost", "capacitor://localhost", "https://threshold-pi-seven.vercel.app", "https://threshold-jet.vercel.app"]
allowed_origins = list(set(origins + local_defaults))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup_event():
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        print("[SERVER] Enforced WindowsProactorEventLoopPolicy for Playwright support")

