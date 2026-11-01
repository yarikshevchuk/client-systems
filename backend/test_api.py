import time

import pytest

import ai
from live import hub


def login(client, email):
    response = client.post("/api/login", json={"email": email, "password": "demo"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["token"]}


def get(client, headers, path):
    response = client.get(path, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def course_id(client, headers, title):
    return next(c["id"] for c in get(client, headers, "/api/courses") if c["title"] == title)


def material_id(client, headers, cid, title):
    topics = get(client, headers, f"/api/courses/{cid}")["topics"]
    return next(m["id"] for t in topics for m in t["materials"] if m["title"] == title)


def test_register_login_profile(client):
    new = client.post("/api/register", json={"name": "Nina Test", "email": "Nina@Test.com", "password": "secret", "role": "student", "grp": "КН-21"})
    assert new.status_code == 200 and new.json()["user"]["email"] == "nina@test.com"
    assert client.post("/api/register", json={"name": "Nina Two", "email": "nina@test.com", "password": "secret", "role": "student", "grp": "КН-21"}).status_code == 409
    assert client.post("/api/register", json={"name": "No Group", "email": "ng@test.com", "password": "secret", "role": "student"}).status_code == 422
    assert client.post("/api/register", json={"name": "Bad Mail", "email": "badmail", "password": "secret", "role": "teacher"}).status_code == 422
    assert client.post("/api/login", json={"email": "nina@test.com", "password": "wrong"}).status_code == 401
    headers = {"Authorization": "Bearer " + new.json()["token"]}
    assert len(get(client, headers, "/api/courses")) == 4
    assert client.put("/api/me", headers=headers, json={"name": "Nina Updated", "bio": "Hi", "grp": "КН-22"}).json()["grp"] == "КН-22"
    assert len(get(client, headers, "/api/courses")) == 1
    assert client.put("/api/me/password", headers=headers, json={"old": "nope", "new": "newpass"}).status_code == 400
    assert client.put("/api/me/password", headers=headers, json={"old": "secret", "new": "newpass"}).status_code == 200
    assert client.post("/api/login", json={"email": "nina@test.com", "password": "newpass"}).status_code == 200
    assert client.get("/api/me").status_code == 401


def test_courses_and_roles(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    other = login(client, "taras@vns.demo")
    admin = login(client, "admin@vns.demo")
    assert len(get(client, student, "/api/courses")) == 4
    assert len(get(client, login(client, "yulia@vns.demo"), "/api/courses")) == 1
    assert [c["title"] for c in get(client, teacher, "/api/courses")] == ["Алгоритми та структури даних", "Чисельні методи"]
    assert len(get(client, other, "/api/courses")) == 3
    assert len(get(client, admin, "/api/courses")) == 5
    assert client.post("/api/courses", headers=student, json={"title": "X", "grp": "КН-21"}).status_code == 403
    created = client.post("/api/courses", headers=teacher, json={"title": "Networks 2", "description": "d", "grp": "КН-99"})
    assert created.status_code == 200
    cid = created.json()["id"]
    assert client.get(f"/api/courses/{cid}", headers=student).status_code == 403
    assert client.get(f"/api/courses/{cid}", headers=other).status_code == 403
    assert client.get(f"/api/courses/{cid}", headers=admin).status_code == 200
    algorithms = course_id(client, student, "Алгоритми та структури даних")
    assert client.put(f"/api/courses/{algorithms}", headers=other, json={"title": "Hack", "grp": "КН-21"}).status_code == 403
    assert client.put(f"/api/courses/{cid}", headers=teacher, json={"title": "Renamed", "description": "", "grp": "КН-99"}).json()["title"] == "Renamed"
    assert client.delete(f"/api/courses/{cid}", headers=teacher).status_code == 200
    assert client.get(f"/api/courses/{cid}", headers=teacher).status_code == 404


def test_content_management(client, template):
    teacher = login(client, "olena@vns.demo")
    student = login(client, "andrii@vns.demo")
    cid = course_id(client, teacher, "Чисельні методи")
    topic = client.post(f"/api/courses/{cid}/topics", headers=teacher, json={"title": "Iterations"}).json()
    assert client.post(f"/api/courses/{cid}/topics", headers=student, json={"title": "X"}).status_code == 403
    second = client.post(f"/api/courses/{cid}/topics", headers=teacher, json={"title": "Interpolation"}).json()
    assert client.post(f"/api/topics/{second['id']}/move", headers=teacher, json={"direction": "up"}).status_code == 200
    titles = [t["title"] for t in get(client, teacher, f"/api/courses/{cid}")["topics"]]
    assert titles == ["Похибки та обумовленість", "Interpolation", "Iterations"]
    assert client.put(f"/api/topics/{topic['id']}", headers=teacher, json={"title": "Iterative methods"}).json()["title"] == "Iterative methods"
    lab = client.post(f"/api/topics/{topic['id']}/materials", headers=teacher, json={
        "title": "Lab 2", "kind": "lab", "content": "Jacobi", "deadline": "2030-01-01T12:00", "max_points": 5}).json()
    assert lab["max_points"] == 5
    assert client.post(f"/api/topics/{topic['id']}/materials", headers=teacher, json={
        "title": "Bad", "kind": "lab", "deadline": "not-a-date", "max_points": 5}).status_code == 422
    updated = client.put(f"/api/materials/{lab['id']}", headers=teacher, json={
        "title": "Lab 2 (updated)", "kind": "lab", "content": "Jacobi and Seidel", "deadline": "2030-02-01T12:00", "max_points": 8}).json()
    assert updated["max_points"] == 8 and updated["title"] == "Lab 2 (updated)"
    assert client.put(f"/api/materials/{lab['id']}", headers=student, json={"title": "X", "kind": "lab", "max_points": 1}).status_code == 403
    attached = client.post(f"/api/materials/{lab['id']}/attachments", headers=teacher, files={"file": ("task.pdf", b"task text")})
    assert attached.status_code == 200
    aid = attached.json()["id"]
    assert client.get(f"/api/attachments/{aid}/file", headers=student).content == b"task text"
    detail = get(client, student, f"/api/materials/{lab['id']}")
    assert detail["attachments"][0]["filename"] == "task.pdf" and detail["can_manage"] is False
    assert client.delete(f"/api/attachments/{aid}", headers=student).status_code == 403
    assert client.delete(f"/api/attachments/{aid}", headers=teacher).status_code == 200
    assert client.delete(f"/api/materials/{lab['id']}", headers=teacher).status_code == 200
    assert client.delete(f"/api/topics/{topic['id']}", headers=teacher).status_code == 200
    people = get(client, student, f"/api/courses/{cid}/people")
    assert people["teacher"]["name"] == "Олена Коваленко" and len(people["students"]) == 5


def test_dashboards_and_gradebook(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    board = get(client, student, "/api/me/dashboard")
    algorithms = next(c for c in board["courses"] if c["title"].startswith("Алгоритми"))
    assert (algorithms["earned"], algorithms["graded_max"], algorithms["total_max"], algorithms["percent_graded"]) == (8, 10, 30, 80)
    titles = [d["title"] for d in board["deadlines"]]
    assert "Лабораторна 3. Графи: BFS і DFS" in titles and "Лабораторна 2. Сортування бульбашкою та злиттям" not in titles
    assert board["due_cards"] == 2 and len(board["announcements"]) >= 2
    grades = get(client, student, f"/api/courses/{algorithms['id']}/grades")
    assert len(grades["labs"]) == 3 and grades["labs"][0]["feedback"].startswith("Добрі вимірювання")
    assert client.get(f"/api/courses/{algorithms['id']}/grades", headers=teacher).status_code == 403
    assert client.get(f"/api/courses/{algorithms['id']}/gradebook", headers=student).status_code == 403
    teacher_board = get(client, teacher, "/api/me/dashboard")
    assert {c["title"]: c["ungraded"] for c in teacher_board["courses"]} == {"Алгоритми та структури даних": 3, "Чисельні методи": 1}
    assert len(teacher_board["recent"]) == 4
    book = get(client, teacher, f"/api/courses/{algorithms['id']}/gradebook")
    assert len(book["labs"]) == 3 and len(book["students"]) == 5 and book["total_max"] == 30
    danylo = next(s for s in book["students"] if s["name"] == "Данило Коваль")
    assert danylo["overdue"] == 1 and danylo["earned"] == 6 and danylo["submitted"] == 1
    maryna = next(s for s in book["students"] if s["name"] == "Марина Шевчук")
    assert maryna["earned"] == 10 and maryna["percent_graded"] == 100 and maryna["submitted"] == 3


def test_submit_grade_feedback(client):
    student = login(client, "andrii@vns.demo")
    other = login(client, "maryna@vns.demo")
    teacher = login(client, "olena@vns.demo")
    cid = course_id(client, student, "Алгоритми та структури даних")
    lab = material_id(client, student, cid, "Лабораторна 3. Графи: BFS і DFS")
    lecture = material_id(client, student, cid, "Лекція 3. Графи: BFS і DFS")
    assert client.post(f"/api/materials/{lecture}/submit", headers=student, files={"file": ("a.pdf", b"x")}).status_code == 400
    assert client.post(f"/api/materials/{lab}/submit", headers=teacher, files={"file": ("a.pdf", b"x")}).status_code == 403
    first = client.post(f"/api/materials/{lab}/submit", headers=student, data={"comment": "first"}, files={"file": ("a.pdf", b"one")})
    second = client.post(f"/api/materials/{lab}/submit", headers=student, data={"comment": "second"}, files={"file": ("b.pdf", b"two")})
    assert first.status_code == 200 and second.json()["id"] == first.json()["id"]
    detail = get(client, student, f"/api/materials/{lab}")
    assert detail["submission"]["filename"] == "b.pdf" and detail["submission"]["comment"] == "second"
    notes = get(client, teacher, "/api/notifications")
    assert any("Нова здача: Андрій Мельник" in n["text"] for n in notes["items"])
    rows = get(client, teacher, f"/api/materials/{lab}/submissions")
    assert len(rows) == 5 and next(r for r in rows if r["name"] == "Андрій Мельник")["comment"] == "second"
    sid = first.json()["id"]
    assert client.get(f"/api/submissions/{sid}/file", headers=teacher).content == b"two"
    assert client.get(f"/api/submissions/{sid}/file", headers=student).content == b"two"
    assert client.get(f"/api/submissions/{sid}/file", headers=other).status_code == 403
    assert client.put(f"/api/submissions/{sid}/grade", headers=teacher, json={"grade": 11}).status_code == 400
    assert client.put(f"/api/submissions/{sid}/grade", headers=student, json={"grade": 5}).status_code == 403
    graded = client.put(f"/api/submissions/{sid}/grade", headers=teacher, json={"grade": 9, "feedback": "Nice BFS"}).json()
    assert graded["grade"] == 9 and graded["feedback"] == "Nice BFS"
    assert any("ви отримали 9 / 10" in n["text"] for n in get(client, student, "/api/notifications")["items"])
    assert client.post(f"/api/materials/{lab}/submit", headers=student, files={"file": ("c.pdf", b"3")}).status_code == 400


def test_announcements(client):
    teacher = login(client, "olena@vns.demo")
    student = login(client, "andrii@vns.demo")
    cid = course_id(client, student, "Алгоритми та структури даних")
    listing = get(client, student, f"/api/courses/{cid}/announcements")
    assert listing[0]["pinned"] is True and listing[0]["read"] is True
    unread = next(a for a in listing if not a["read"] and a["title"] == "Лабораторна 3: лишилося два дні")
    assert client.post(f"/api/announcements/{unread['id']}/read", headers=student).status_code == 200
    assert client.post(f"/api/courses/{cid}/announcements", headers=student, json={"title": "x", "body": "y"}).status_code == 403
    created = client.post(f"/api/courses/{cid}/announcements", headers=teacher, json={"title": "Moved lecture", "body": "Friday 10:00", "pinned": False})
    assert created.status_code == 200
    assert any("Moved lecture" in n["text"] for n in get(client, student, "/api/notifications")["items"])
    mine = get(client, teacher, f"/api/courses/{cid}/announcements")
    new = next(a for a in mine if a["title"] == "Moved lecture")
    assert new["reads"] == 1 and new["audience"] == 5
    readers = get(client, teacher, f"/api/announcements/{new['id']}/readers")
    assert len(readers) == 5 and all(r["read_at"] is None for r in readers)
    assert client.post(f"/api/announcements/{new['id']}/pin", headers=teacher).json() == {"pinned": True}
    assert get(client, student, f"/api/courses/{cid}/announcements")[0]["pinned"] is True
    assert client.delete(f"/api/announcements/{new['id']}", headers=student).status_code == 403
    assert client.delete(f"/api/announcements/{new['id']}", headers=teacher).status_code == 200


def test_discussion(client):
    student = login(client, "andrii@vns.demo")
    classmate = login(client, "ivan@vns.demo")
    teacher = login(client, "olena@vns.demo")
    cid = course_id(client, student, "Алгоритми та структури даних")
    threads = get(client, student, f"/api/courses/{cid}/messages?channel=qa")
    assert sum(1 for m in threads if m["parent_id"] is None) == 3
    assert client.get(f"/api/courses/{cid}/messages?channel=nope", headers=student).status_code == 422
    question = client.post(f"/api/courses/{cid}/messages", headers=student, json={"channel": "qa", "text": "What is O(n log n)?"}).json()
    assert any("Нове питання" in n["text"] for n in get(client, teacher, "/api/notifications")["items"])
    reply = client.post(f"/api/courses/{cid}/messages", headers=teacher, json={"text": "Merge sort is O(n log n).", "parent_id": question["id"]}).json()
    assert reply["parent_id"] == question["id"] and reply["channel"] == "qa"
    assert any("нова відповідь на ваше питання" in n["text"] for n in get(client, student, "/api/notifications")["items"])
    assert client.post(f"/api/messages/{reply['id']}/accept", headers=classmate).status_code == 403
    assert client.post(f"/api/messages/{reply['id']}/accept", headers=student).json() == {"accepted": True}
    rows = get(client, student, f"/api/courses/{cid}/messages?channel=qa")
    assert next(m for m in rows if m["id"] == question["id"])["resolved"] is True
    assert next(m for m in rows if m["id"] == reply["id"])["accepted"] is True
    assert client.post(f"/api/messages/{reply['id']}/accept", headers=student).json() == {"accepted": False}
    general = client.post(f"/api/courses/{cid}/messages", headers=student, json={"channel": "general", "text": "Hi all"})
    assert general.status_code == 200 and general.json()["channel"] == "general"
    assert client.post(f"/api/courses/{cid}/messages", headers=student, json={"text": "   "}).status_code == 422
    assert client.delete(f"/api/messages/{question['id']}", headers=classmate).status_code == 403
    assert client.delete(f"/api/messages/{question['id']}", headers=student).status_code == 200
    assert client.post(f"/api/courses/{cid}/messages", headers=login(client, "yulia@vns.demo"), json={"text": "hello"}).status_code == 403


def test_direct_messages(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    maryna = login(client, "maryna@vns.demo")
    names = [c["name"] for c in get(client, student, "/api/contacts")]
    assert "Олена Коваленко" in names and "Тарас Бондар" in names and "Юлія Лисенко" not in names
    assert get(client, student, "/api/me/counters")["messages"] == 1
    conversations = get(client, student, "/api/dm")
    assert [c["user"]["name"] for c in conversations] == ["Марина Шевчук", "Олена Коваленко"] and conversations[0]["unread"] == 1
    thread = get(client, student, f"/api/dm/{conversations[0]['user']['id']}")
    assert len(thread["messages"]) == 1 and get(client, student, "/api/me/counters")["messages"] == 0
    olena_id = conversations[1]["user"]["id"]
    sent = client.post(f"/api/dm/{olena_id}", headers=student, json={"text": "One more question"})
    assert sent.status_code == 200
    assert get(client, teacher, "/api/me/counters")["messages"] == 2
    yulia = next(u for u in get(client, login(client, "admin@vns.demo"), "/api/contacts") if u["name"] == "Юлія Лисенко")
    assert client.post(f"/api/dm/{yulia['id']}", headers=student, json={"text": "hi"}).status_code == 403
    assert client.post(f"/api/dm/{olena_id}", headers=maryna, json={"text": " "}).status_code == 422


def test_spaces(client):
    student = login(client, "andrii@vns.demo")
    outsider = login(client, "danylo@vns.demo")
    spaces = get(client, outsider, "/api/spaces")
    assert len(spaces) == 3
    prep = next(s for s in spaces if s["title"] == "Підготовка до іспиту з алгоритмів")
    assert prep["joined"] is False and prep["members"] == 4
    assert get(client, outsider, "/api/spaces?q=sql")[0]["title"] == "SQL-клуб"
    detail = get(client, outsider, f"/api/spaces/{prep['id']}")
    assert detail["joined"] is False and detail["messages"] == []
    assert client.post(f"/api/spaces/{prep['id']}/messages", headers=outsider, json={"text": "hi"}).status_code == 403
    assert client.post(f"/api/spaces/{prep['id']}/join", headers=outsider).status_code == 200
    detail = get(client, outsider, f"/api/spaces/{prep['id']}")
    assert detail["joined"] is True and len(detail["messages"]) == 4 and len(detail["members"]) == 5
    assert client.post(f"/api/spaces/{prep['id']}/messages", headers=outsider, json={"text": "I joined"}).status_code == 200
    assert client.post(f"/api/spaces/{prep['id']}/leave", headers=outsider).json() == {"joined": False}
    created = client.post("/api/spaces", headers=student, json={"title": "Graph club", "topic": "Graphs", "description": "BFS"}).json()
    assert created["members"] == 1
    assert client.post(f"/api/spaces/{created['id']}/leave", headers=student).status_code == 400
    assert client.delete(f"/api/spaces/{created['id']}", headers=outsider).status_code == 403
    assert client.delete(f"/api/spaces/{created['id']}", headers=student).status_code == 200


def test_notes_and_flashcards(client):
    student = login(client, "andrii@vns.demo")
    other = login(client, "maryna@vns.demo")
    cid = course_id(client, student, "Алгоритми та структури даних")
    lecture = material_id(client, student, cid, "Лекція 1. Складність алгоритмів")
    assert client.put(f"/api/materials/{lecture}/note", headers=student, json={"text": "My note"}).status_code == 200
    assert get(client, student, f"/api/materials/{lecture}")["note"] == "My note"
    assert get(client, other, f"/api/materials/{lecture}")["note"] == ""
    cards = get(client, student, "/api/flashcards")
    assert len(cards["cards"]) == 4 and cards["due"] == 2
    created = client.post("/api/flashcards", headers=student, json={"material_id": lecture, "front": "Q", "back": "A"}).json()
    assert get(client, student, "/api/flashcards")["due"] == 3
    right = client.post(f"/api/flashcards/{created['id']}/review", headers=student, json={"correct": True}).json()
    assert right["box"] == 2 and get(client, student, "/api/flashcards")["due"] == 2
    wrong = client.post(f"/api/flashcards/{created['id']}/review", headers=student, json={"correct": False}).json()
    assert wrong["box"] == 1
    assert client.delete(f"/api/flashcards/{created['id']}", headers=other).status_code == 404
    assert client.delete(f"/api/flashcards/{created['id']}", headers=student).status_code == 200


def test_ai(client, monkeypatch):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    databases = course_id(client, student, "Бази даних")
    db_lecture = material_id(client, student, databases, "Лекція 1. Реляційні бази даних")
    assert client.post(f"/api/courses/{databases}/ask", headers=student, json={"question": "primary key"}).status_code == 403
    assert client.post(f"/api/materials/{db_lecture}/flashcards/generate", headers=student).status_code == 403
    assert client.post(f"/api/materials/{db_lecture}/summary", headers=student).status_code == 200
    algorithms = course_id(client, student, "Алгоритми та структури даних")
    lecture = material_id(client, student, algorithms, "Лекція 3. Графи: BFS і DFS")
    lab = material_id(client, student, algorithms, "Лабораторна 3. Графи: BFS і DFS")
    assert client.put(f"/api/courses/{algorithms}/ai-settings", headers=student, json={"summaries_on": True, "ask_on": True, "flashcards_on": True}).status_code == 403
    assert client.put(f"/api/courses/{databases}/ai-settings", headers=teacher, json={"summaries_on": True, "ask_on": True, "flashcards_on": True}).status_code == 403
    first = client.post(f"/api/materials/{lecture}/summary", headers=student).json()
    second = client.post(f"/api/materials/{lecture}/summary", headers=student).json()
    assert first["cached"] is False and second["cached"] is True
    assert client.post(f"/api/materials/{lab}/summary", headers=student).status_code == 400
    used = get(client, student, "/api/ai/usage")["used"]
    answer = client.post(f"/api/courses/{algorithms}/ask", headers=student, json={"question": "What is BFS?"}).json()
    assert answer["found"] and any(s["id"] == lecture for s in answer["sources"]) and answer["graded"] is False
    assert get(client, student, "/api/ai/usage")["used"] == used + 1
    missing = client.post(f"/api/courses/{algorithms}/ask", headers=student, json={"question": "How to cook pasta"}).json()
    assert missing == {"found": False, "answer": "Немає в матеріалах курсу", "sources": []}
    assert get(client, student, "/api/ai/usage")["used"] == used + 1
    graded = client.post(f"/api/courses/{algorithms}/ask", headers=student, json={"question": "Реалізуйте і виведіть"}).json()
    assert graded["graded"] and "не даю готового розв'язку" in graded["answer"]
    generated = client.post(f"/api/materials/{lecture}/flashcards/generate", headers=student).json()
    assert generated["demo"] and len(generated["cards"]) >= 3 and "_____" in generated["cards"][0]["front"]
    assert get(client, student, "/api/flashcards")["due"] >= 5
    assert client.put(f"/api/courses/{databases}/ai-settings", headers=login(client, "taras@vns.demo"),
                      json={"summaries_on": True, "ask_on": True, "flashcards_on": False}).json()["ask_on"] is True
    monkeypatch.setattr(ai, "DAILY_LIMIT", 1)
    limited = client.post(f"/api/courses/{algorithms}/ask", headers=student, json={"question": "What is DFS?"})
    assert limited.status_code == 429


def test_notifications_calendar_search(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    notes = get(client, student, "/api/notifications")
    assert any("до дедлайну менше" in n["text"] for n in notes["items"])
    assert notes["unread"] >= 2
    assert client.post(f"/api/notifications/{notes['items'][0]['id']}/read", headers=student).status_code == 200
    assert client.post("/api/notifications/read-all", headers=student).status_code == 200
    assert get(client, student, "/api/me/counters")["notifications"] == 0
    assert get(client, student, "/api/notifications")["unread"] == 0
    events = get(client, student, "/api/calendar")
    assert len(events) == 7 and any(e["overdue"] is False and e["title"].startswith("Лабораторна 3") for e in events)
    assert len(get(client, teacher, "/api/calendar")) == 4
    ics = client.get("/api/calendar.ics", headers=student)
    assert ics.status_code == 200 and "BEGIN:VEVENT" in ics.text and ics.headers["content-type"].startswith("text/calendar")
    found = get(client, student, "/api/search?q=BFS")
    assert any(m["title"].startswith("Лекція 3") for m in found["materials"])
    assert get(client, student, "/api/search?q=a") == {"courses": [], "materials": [], "announcements": [], "messages": [], "spaces": [], "people": []}
    assert any(c["title"] == "Бази даних" for c in get(client, student, "/api/search?q=бази")["courses"])
    assert any(p["name"] == "Олена Коваленко" for p in get(client, student, "/api/search?q=олена")["people"])
    assert get(client, student, "/api/search?q=іспит")["spaces"][0]["title"] == "Підготовка до іспиту з алгоритмів"


def test_admin(client):
    admin = login(client, "admin@vns.demo")
    student = login(client, "andrii@vns.demo")
    assert get(client, admin, "/api/admin/stats")["users"] == 10
    assert client.get("/api/admin/stats", headers=student).status_code == 403
    users = get(client, admin, "/api/admin/users")
    andrii = next(u for u in users if u["name"] == "Андрій Мельник")
    assert client.put(f"/api/admin/users/{andrii['id']}", headers=admin, json={"role": "teacher"}).json()["role"] == "teacher"
    me = next(u for u in users if u["role"] == "admin")
    assert client.put(f"/api/admin/users/{me['id']}", headers=admin, json={"role": "student"}).status_code == 400
    assert client.put("/api/admin/users/99999", headers=admin, json={"role": "student"}).status_code == 404


def wait_connected(user_id):
    for _ in range(200):
        if hub.sockets.get(user_id):
            return
        time.sleep(0.02)
    raise AssertionError("socket was not registered")


def test_live_events(client):
    student = login(client, "andrii@vns.demo")
    teacher = login(client, "olena@vns.demo")
    token = student["Authorization"].split()[1]
    cid = course_id(client, student, "Алгоритми та структури даних")
    contacts = get(client, student, "/api/contacts")
    olena = next(c["id"] for c in contacts if c["name"] == "Олена Коваленко")
    with client.websocket_connect(f"/ws?token={token}") as socket:
        wait_connected(get(client, student, "/api/me")["id"])
        client.post(f"/api/courses/{cid}/messages", headers=teacher, json={"channel": "general", "text": "Live hello"})
        event = socket.receive_json()
        assert event["type"] == "message" and event["message"]["text"] == "Live hello"
        client.post(f"/api/dm/{olena}", headers=student, json={"text": "ping"})
        client.post(f"/api/dm/{get(client, student, '/api/me')['id']}", headers=teacher, json={"text": "pong"})
        event = socket.receive_json()
        assert event["type"] == "dm" and event["message"]["text"] == "pong"
    with pytest.raises(Exception):
        with client.websocket_connect("/ws?token=bad"):
            pass
