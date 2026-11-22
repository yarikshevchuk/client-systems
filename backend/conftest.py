import os

import psycopg
import pytest
from fastapi.testclient import TestClient

import db

BASE = "postgresql://vns:vns@127.0.0.1:5440/"


def run_admin(sql):
    with psycopg.connect(BASE + "postgres", autocommit=True) as conn:
        conn.execute(sql)


@pytest.fixture(scope="session")
def template(tmp_path_factory):
    uploads = tmp_path_factory.mktemp("uploads")
    original = db.UPLOADS
    db.UPLOADS = uploads
    run_admin("drop database if exists vns_template with (force)")
    run_admin("create database vns_template")
    os.environ["DATABASE_URL"] = BASE + "vns_template"
    import seed
    db.init()
    seed.seed()
    del os.environ["DATABASE_URL"]
    yield uploads
    db.UPLOADS = original


@pytest.fixture()
def client(template, monkeypatch):
    run_admin("drop database if exists vns_test with (force)")
    run_admin("create database vns_test template vns_template")
    monkeypatch.setenv("DATABASE_URL", BASE + "vns_test")
    monkeypatch.setattr(db, "UPLOADS", template)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from main import app
    with TestClient(app) as test_client:
        yield test_client
