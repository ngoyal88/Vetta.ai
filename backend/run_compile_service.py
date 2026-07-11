from __future__ import annotations

import uvicorn


if __name__ == "__main__":
    uvicorn.run(
        "services.resume_builder.compile_app:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )

