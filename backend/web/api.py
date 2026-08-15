from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from web.routes import router

app = FastAPI(
    title="Threshold Backend",
    description="SRM Academia scraper backend for the Threshold companion app",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
