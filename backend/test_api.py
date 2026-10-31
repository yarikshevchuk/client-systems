import pytest
from fastapi.testclient import TestClient

import db


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DB", str(tmp_path / "test.db"))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(db, "UPLOADS", tmp_path / "uploads")
    from main import app
    with TestClient(app) as test_client:
        yield test_client


def login(client, email):
    response = client.post("/api/login", json={"email": email, "password": "demo"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["token"]}


def course_id(client, headers, title):
    courses = client.get("/api/courses", headers=headers).json()
    return next(c["id"] for c in courses if c["title"] == title)


def material_id(client, headers, cid, title):
    topics = client.get(f"/api/courses/{cid}", headers=headers).json()["topics"]
    return next(m["id"] for t in topics for m in t["materials"] if m["title"] == title)


def test_login_and_me(client):
    assert client.post("/api/login", json={"email": "andrii@vns.demo", "password": "wrong"}).status_code == 401
    assert client.get("/api/me").status_code == 401
    headers = login(client, "andrii@vns.demo")
    me = client.get("/api/me", headers=headers).json()
    assert me["role"] == "student" and "password_hash" not in me


def test_courses_and_roles(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    assert len(client.get("/api/courses", headers=student).json()) == 2
    assert client.post("/api/courses", headers=student, json={"title": "X", "grp": "CS-21"}).status_code == 403
    created = client.post("/api/courses", headers=teacher, json={"title": "Networks", "grp": "CS-99"})
    assert created.status_code == 200
    assert len(client.get("/api/courses", headers=student).json()) == 2
    assert client.get(f"/api/courses/{created.json()['id']}", headers=student).status_code == 403


def test_teacher_adds_topic_and_material(client):
    teacher = login(client, "olena@vns.demo")
    student = login(client, "andrii@vns.demo")
    cid = course_id(client, teacher, "Databases")
    topic = client.post(f"/api/courses/{cid}/topics", headers=teacher, json={"title": "Topic 2. SQL"}).json()
    lab = client.post(f"/api/topics/{topic['id']}/materials", headers=teacher, json={
        "title": "Lab 2. Queries", "kind": "lab", "content": "Write queries.",
        "deadline": "2030-01-01T12:00", "max_points": 5}).json()
    assert lab["max_points"] == 5
    detail = client.get(f"/api/courses/{cid}", headers=student).json()
    assert detail["topics"][-1]["materials"][0]["title"] == "Lab 2. Queries"
    assert client.post(f"/api/courses/{cid}/topics", headers=student, json={"title": "X"}).status_code == 403


def test_dashboard_and_grades(client):
    student = login(client, "andrii@vns.demo")
    board = client.get("/api/me/dashboard", headers=student).json()
    titles = [d["title"] for d in board["deadlines"]]
    assert "Lab 3. Graphs: BFS and DFS" in titles and "Lab 2. Bubble sort and merge sort" not in titles
    algorithms = next(c for c in board["courses"] if c["title"].startswith("Algorithms"))
    assert (algorithms["earned"], algorithms["graded_max"], algorithms["total_max"]) == (8, 10, 30)
    assert algorithms["percent_graded"] == 80
    cid = algorithms["id"]
    grades = client.get(f"/api/courses/{cid}/grades", headers=student).json()
    assert len(grades["labs"]) == 3
    teacher = login(client, "olena@vns.demo")
    assert client.get(f"/api/courses/{cid}/grades", headers=teacher).status_code == 403
    board = client.get("/api/me/dashboard", headers=teacher).json()
    assert next(c for c in board["courses"] if c["id"] == cid)["ungraded"] == 1


def test_submit_and_grade(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    cid = course_id(client, student, "Algorithms and Data Structures")
    lab = material_id(client, student, cid, "Lab 3. Graphs: BFS and DFS")
    lecture = material_id(client, student, cid, "Lecture 3. Graphs: BFS and DFS")
    assert client.post(f"/api/materials/{lecture}/submit", headers=student,
                       files={"file": ("a.pdf", b"x")}).status_code == 400
    assert client.post(f"/api/materials/{lab}/submit", headers=teacher,
                       files={"file": ("a.pdf", b"x")}).status_code == 403
    first = client.post(f"/api/materials/{lab}/submit", headers=student, files={"file": ("a.pdf", b"one")})
    second = client.post(f"/api/materials/{lab}/submit", headers=student, files={"file": ("b.pdf", b"two")})
    assert first.status_code == 200 and second.json()["id"] == first.json()["id"]
    assert client.get(f"/api/materials/{lab}", headers=student).json()["submission"]["filename"] == "b.pdf"

    rows = client.get(f"/api/materials/{lab}/submissions", headers=teacher).json()
    assert {r["name"] for r in rows} == {"Andrii Melnyk", "Maryna Shevchuk"}
    sid = first.json()["id"]
    assert client.get(f"/api/submissions/{sid}/file", headers=teacher).content == b"two"
    assert client.put(f"/api/submissions/{sid}/grade", headers=teacher, json={"grade": 11}).status_code == 400
    assert client.put(f"/api/submissions/{sid}/grade", headers=student, json={"grade": 5}).status_code == 403
    assert client.put(f"/api/submissions/{sid}/grade", headers=teacher, json={"grade": 9}).json()["grade"] == 9
    assert client.post(f"/api/materials/{lab}/submit", headers=student,
                       files={"file": ("c.pdf", b"3")}).status_code == 400


def test_chat_history_and_websocket(client):
    student = login(client, "andrii@vns.demo")
    cid = course_id(client, student, "Algorithms and Data Structures")
    token = student["Authorization"].split()[1]
    assert len(client.get(f"/api/courses/{cid}/messages", headers=student).json()) == 3
    with client.websocket_connect(f"/ws/{cid}?token={token}") as socket:
        posted = client.post(f"/api/courses/{cid}/messages", headers=student,
                             json={"text": "Hello group", "is_question": True})
        assert posted.status_code == 200
        pushed = socket.receive_json()
        assert pushed["text"] == "Hello group" and pushed["author"] == "Andrii Melnyk"
    assert client.get(f"/api/courses/{cid}/messages", headers=student).json()[-1]["is_question"] == 1
    assert client.post(f"/api/courses/{cid}/messages", headers=student, json={"text": "   "}).status_code == 422
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/{cid}?token=bad"):
            pass


def test_ai_off_by_default_and_toggle(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    cid = course_id(client, student, "Databases")
    lecture = material_id(client, student, cid, "Lecture 1. Relational databases")
    assert client.post(f"/api/materials/{lecture}/summary", headers=student).status_code == 403
    assert client.post(f"/api/courses/{cid}/ask", headers=student, json={"question": "primary key"}).status_code == 403
    assert client.put(f"/api/courses/{cid}/ai-settings", headers=student,
                      json={"summaries_on": True, "ask_on": True}).status_code == 403
    assert client.put(f"/api/courses/{cid}/ai-settings", headers=teacher,
                      json={"summaries_on": True, "ask_on": False}).json() == {"summaries_on": True, "ask_on": False}
    assert client.post(f"/api/materials/{lecture}/summary", headers=student).status_code == 200
    assert client.post(f"/api/courses/{cid}/ask", headers=student, json={"question": "primary key"}).status_code == 403


def test_ai_summary_cached_and_ask(client):
    student = login(client, "andrii@vns.demo")
    cid = course_id(client, student, "Algorithms and Data Structures")
    lecture = material_id(client, student, cid, "Lecture 3. Graphs: BFS and DFS")
    lab = material_id(client, student, cid, "Lab 3. Graphs: BFS and DFS")
    first = client.post(f"/api/materials/{lecture}/summary", headers=student).json()
    second = client.post(f"/api/materials/{lecture}/summary", headers=student).json()
    assert first["cached"] is False and second["cached"] is True and second["summary"] == first["summary"]
    assert client.post(f"/api/materials/{lab}/summary", headers=student).status_code == 400

    answer = client.post(f"/api/courses/{cid}/ask", headers=student, json={"question": "What is BFS?"}).json()
    assert answer["found"] and any(s["id"] == lecture for s in answer["sources"])
    missing = client.post(f"/api/courses/{cid}/ask", headers=student, json={"question": "How to cook pasta"}).json()
    assert missing == {"found": False, "answer": "Not found in the course materials", "sources": []}
    graded = client.post(f"/api/courses/{cid}/ask", headers=student,
                         json={"question": "implement BFS and DFS adjacency list print vertices"}).json()
    assert graded["graded"] and "will not give a ready solution" in graded["answer"]
