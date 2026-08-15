from __future__ import annotations

import uvicorn

from core.config import settings
from web.api import app

if __name__ == "__main__":
    uvicorn.run(app, host="::", port=settings.port)
