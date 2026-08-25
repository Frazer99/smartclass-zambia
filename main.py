from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import admin_content, auth, catalog, lessons, past_papers, progress, subscriptions

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(admin_content.router)
app.include_router(lessons.router)
app.include_router(past_papers.router)
app.include_router(progress.router)
app.include_router(subscriptions.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
