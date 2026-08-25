"""End-to-end smoke tests covering the flows the SRS treats as MVP acceptance
criteria: register -> pick Form/subject -> lesson with the AI teacher ->
past-paper walkthrough -> free-trial cutoff -> subscribe -> access restored,
plus the admin content pipeline (syllabus upload -> auto topics)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = "sqlite:///./test_smartclass.db"
os.environ["TRIAL_SECONDS_PER_SUBJECT"] = "60"  # short trial to make cutoff tests fast

import pytest
from fastapi.testclient import TestClient

if os.path.exists("./test_smartclass.db"):
    os.remove("./test_smartclass.db")

from app.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(scope="module")
def admin_token():
    client.post(
        "/api/auth/register",
        json={"full_name": "Admin", "email": "admin@test.zm", "password": "password123"},
    )
    # promote to admin directly via DB since register always creates students
    from app.core.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    user = db.query(User).filter(User.email == "admin@test.zm").first()
    user.role = "admin"
    db.commit()
    db.close()

    res = client.post("/api/auth/login", json={"email": "admin@test.zm", "password": "password123"})
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def student_token():
    res = client.post(
        "/api/auth/register",
        json={"full_name": "Student", "email": "student@test.zm", "password": "password123", "form_level": 4},
    )
    return res.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health():
    assert client.get("/api/health").status_code == 200


def test_admin_creates_subject_and_syllabus(admin_token, tmp_path):
    res = client.post(
        "/api/admin/subjects",
        data={"name": "Mathematics", "description": "ECZ Mathematics"},
        headers=auth(admin_token),
    )
    assert res.status_code == 200
    subject_id = res.json()["id"]

    client.post(
        f"/api/admin/subjects/{subject_id}/offerings", data={"form_level": 4}, headers=auth(admin_token)
    )

    syllabus_file = tmp_path / "syllabus.txt"
    syllabus_file.write_text("Topic 1: Linear Equations\nTopic 2: Quadratic Equations\n")
    with open(syllabus_file, "rb") as f:
        res = client.post(
            "/api/admin/syllabus",
            data={"subject_id": subject_id, "form_level": 4},
            files={"file": ("syllabus.txt", f, "text/plain")},
            headers=auth(admin_token),
        )
    assert res.status_code == 200
    assert res.json()["topics_created"] == 2

    res = client.post(
        "/api/admin/materials",
        data={"subject_id": subject_id, "form_level": 4, "title": "Pamphlet", "material_type": "pamphlet"},
        files={"file": ("m.txt", b"To solve a linear equation, isolate the unknown by doing the same operation to both sides.", "text/plain")},
        headers=auth(admin_token),
    )
    assert res.status_code == 200


def test_student_sees_form_subjects(student_token):
    res = client.get("/api/catalog/subjects?form_level=4", headers=auth(student_token))
    assert res.status_code == 200
    names = [s["name"] for s in res.json()]
    assert "Mathematics" in names


def test_lesson_flow_and_trial_cutoff(student_token):
    subject_id = client.get("/api/catalog/subjects?form_level=4", headers=auth(student_token)).json()[0]["id"]
    topic_id = client.get(
        f"/api/catalog/topics?subject_id={subject_id}&form_level=4", headers=auth(student_token)
    ).json()[0]["id"]

    res = client.post(
        "/api/lessons/start", json={"subject_id": subject_id, "topic_id": topic_id}, headers=auth(student_token)
    )
    assert res.status_code == 200
    session_id = res.json()["id"]
    assert res.json()["messages"][0]["role"] == "teacher"

    # Burn through the (60s) trial allowance.
    res = client.post(
        "/api/lessons/message",
        json={"session_id": session_id, "content": "not sure", "elapsed_seconds": 55},
        headers=auth(student_token),
    )
    assert res.status_code == 200

    res = client.post(
        "/api/lessons/message",
        json={"session_id": session_id, "content": "still not sure", "elapsed_seconds": 55},
        headers=auth(student_token),
    )
    assert res.status_code == 200  # trial usage is now at the 60s cap but this call is still allowed through

    res = client.post(
        "/api/lessons/message",
        json={"session_id": session_id, "content": "still not sure", "elapsed_seconds": 5},
        headers=auth(student_token),
    )
    assert res.status_code == 402
    assert res.json()["detail"]["code"] == "TRIAL_EXPIRED"


def test_subscribe_unlocks_access(student_token):
    subject_id = client.get("/api/catalog/subjects?form_level=4", headers=auth(student_token)).json()[0]["id"]

    res = client.post(
        "/api/billing/pay",
        json={"subject_id": subject_id, "method": "mtn_momo", "msisdn": "+260971234567"},
        headers=auth(student_token),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    trial = client.get(f"/api/lessons/trial-status/{subject_id}", headers=auth(student_token)).json()
    assert trial["has_active_subscription"] is True


def test_past_paper_flow(admin_token, student_token):
    subject_id = client.get("/api/catalog/subjects?form_level=4", headers=auth(student_token)).json()[0]["id"]
    res = client.post(
        "/api/admin/past-papers",
        json={
            "subject_id": subject_id,
            "form_level": 4,
            "year": 2025,
            "title": "Specimen Paper",
            "questions": [
                {"question_number": "1", "question_text": "Solve 2x+5=15", "marks": 2, "answer_guide": "Subtract 5, then divide by 2 to get x=5."}
            ],
        },
        headers=auth(admin_token),
    )
    assert res.status_code == 200
    paper = res.json()
    q_id = paper["questions"][0]["id"]

    res = client.post(
        "/api/past-papers/start",
        json={"past_paper_id": paper["id"], "question_ids": [q_id]},
        headers=auth(student_token),
    )
    assert res.status_code == 200
    session_id = res.json()["id"]
    assert "Question 1" in res.json()["messages"][0]["content"]

    res = client.post(
        "/api/past-papers/message",
        json={"session_id": session_id, "content": "next", "elapsed_seconds": 5},
        headers=auth(student_token),
    )
    assert res.status_code == 200
    assert res.json()["ended_at"] is not None  # only one question selected -> session ends
