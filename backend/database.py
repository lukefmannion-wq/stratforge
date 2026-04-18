import logging
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from fastapi import HTTPException, status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL, future=True, connect_args={"sslmode": "require"}) if DATABASE_URL else None

if engine is not None:
    try:
        with engine.connect() as conn:
            logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
SessionLocal = (
    sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    if engine is not None
    else None
)
Base = declarative_base()

def get_db():
    if SessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured on this deployment.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
