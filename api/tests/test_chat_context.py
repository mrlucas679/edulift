"""The chat finds bursaries, learnerships and loans by what the learner asks about."""

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session as DbSession

from app.assist import retrieve
from app.seed import read, write
from tests.test_seed import REPO_DATA


@pytest.fixture
def repo_data(engine: Engine) -> None:
    write(engine, read(REPO_DATA))


def test_a_bursary_question_brings_up_bursaries(engine: Engine, repo_data: None) -> None:
    with DbSession(engine) as db:
        found = retrieve(db, "which bursaries can I apply for")
    assert found
    assert all(r.id.startswith("opportunity:") for r in found)


def test_a_loan_question_brings_up_nsfas(engine: Engine, repo_data: None) -> None:
    with DbSession(engine) as db:
        ids = [r.id for r in retrieve(db, "how do I get a student loan")]
    assert "handoff:nsfas" in ids


def test_a_learnership_question_brings_up_learnerships(engine: Engine, repo_data: None) -> None:
    with DbSession(engine) as db:
        found = retrieve(db, "any learnerships available")
    assert found
    assert all(r.id.startswith("opportunity:") for r in found)


def test_bursaries_for_a_field_come_before_courses(engine: Engine, repo_data: None) -> None:
    with DbSession(engine) as db:
        found = retrieve(db, "Which bursaries are open for computer science?")
    assert found[0].id.startswith("opportunity:")


def test_a_course_question_ranks_the_closest_name_first(engine: Engine, repo_data: None) -> None:
    with DbSession(engine) as db:
        found = retrieve(db, "Tell me about computer science informatics")
    assert "INFORMATICS" in found[0].title.upper()
