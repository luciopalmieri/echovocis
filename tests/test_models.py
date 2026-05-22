from sqlalchemy import create_engine, inspect

from src.db.models import Base, User, Session, Mistake, Progress, Exercise


def test_models_create_tables():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert "users" in tables
    assert "sessions" in tables
    assert "messages" in tables
    assert "mistakes" in tables
    assert "progress" in tables
    assert "exercises" in tables
    assert "exercise_mistake" in tables
