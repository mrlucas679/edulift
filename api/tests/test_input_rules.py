"""Every input has a rule; anything else is refused with a message that says the rule."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from tests.conftest import Session as Signed
from tests.conftest import sign_in

BIRTH = "2005-03-01"


@pytest.fixture
def me(client: TestClient, inbox: dict[str, str]) -> Signed:
    return sign_in(client, inbox, "rules@example.org")


def profile(client: TestClient, me: Signed, **fields: object) -> dict[str, object]:
    body = {"birth_date": BIRTH} | fields
    reply = client.put("/v1/me/profile", json=body, headers=me.headers)
    return {"status": reply.status_code, "text": reply.text}


@pytest.mark.parametrize(
    "name",
    ["Thandi", "Mary-Jane", "O'Neil", "O’Neil", "Ntombi Zodwa", "Émile", "ǃXóõ"],  # noqa: RUF001 - real names use these letters
)
def test_real_names_in_any_language_are_accepted(client: TestClient, me: Signed, name: str) -> None:
    assert profile(client, me, first_name=name)["status"] == 200


@pytest.mark.parametrize(
    "name",
    ["Th4ndi", "<b>Thandi</b>", "Ann  Lee", "-Ann", "Lerato_", "Robert'); DROP TABLE", "x" * 61],
)
def test_names_with_digits_symbols_or_markup_are_refused(
    client: TestClient, me: Signed, name: str
) -> None:
    reply = profile(client, me, first_name=name)
    assert reply["status"] == 422
    assert name not in str(reply["text"])  # never echoed back


def test_a_refused_name_says_the_rule(client: TestClient, me: Signed) -> None:
    assert "letters, spaces, apostrophes and hyphens" in str(
        profile(client, me, first_name="Th4ndi")["text"]
    )


@pytest.mark.parametrize("province", ["Gauteng", "KwaZulu-Natal", "Western Cape"])
def test_the_nine_provinces_are_accepted(client: TestClient, me: Signed, province: str) -> None:
    assert profile(client, me, province=province)["status"] == 200


@pytest.mark.parametrize("province", ["gauteng", "Atlantis", "Gauteng; DROP", ""])
def test_anything_else_as_a_province_is_refused(
    client: TestClient, me: Signed, province: str
) -> None:
    assert profile(client, me, province=province)["status"] == 422


@pytest.mark.parametrize(
    "birth", [str(date.today() + timedelta(days=1)), "1899-12-31", "2005-02-30", "05/03/2005"]
)
def test_impossible_birthdays_are_refused(client: TestClient, me: Signed, birth: str) -> None:
    reply = client.put("/v1/me/profile", json={"birth_date": birth}, headers=me.headers)
    assert reply.status_code == 422


@pytest.mark.parametrize("interests", [["IT"], ["it it"], ["../etc"], ["x" * 81]])
def test_interests_must_be_ids(client: TestClient, me: Signed, interests: list[str]) -> None:
    assert profile(client, me, interests=interests)["status"] == 422


@pytest.mark.parametrize(
    "marks",
    [
        {"Mathematics": 60},
        {"mathematics": -1},
        {"mathematics": 101},
        {"mathematics": 60.5},
        {"mathematics": "60"},
        {f"s{n}": 50 for n in range(16)},
        {},
    ],
)
def test_marks_must_be_known_shapes_and_0_to_100(
    client: TestClient, marks: dict[str, object]
) -> None:
    assert client.post("/v1/aps/preview", json={"marks": marks}).status_code == 422


@pytest.mark.parametrize("ids", [["UJ.BSC"], ["uj bsc"], ["<x>"], ["a", "a"]])
def test_plan_takes_course_ids_only(client: TestClient, me: Signed, ids: list[str]) -> None:
    assert (
        client.put("/v1/me/plan", json={"programme_ids": ids}, headers=me.headers).status_code
        == 422
    )


@pytest.mark.parametrize(
    "body",
    [
        {"target_kind": "programme", "target_id": "Bad Id"},
        {"target_kind": "programme", "target_id": "uj.x", "extra": 1},
        {"target_kind": "school", "target_id": "uj.x"},
    ],
)
def test_saving_takes_ids_and_nothing_else(
    client: TestClient, me: Signed, body: dict[str, object]
) -> None:
    assert client.post("/v1/me/saved", json=body, headers=me.headers).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"notes": "fine", "owner": "someone-else"},
        {"notes": "bell\x07"},
        {"submitted_on": str(date.today() + timedelta(days=1))},
        {"offer_deadline": "1999-01-01"},
        {"status": "hacked"},
    ],
)
def test_application_edits_are_checked(
    client: TestClient, me: Signed, body: dict[str, object]
) -> None:
    assert client.patch("/v1/me/applications/1", json=body, headers=me.headers).status_code == 422


@pytest.mark.parametrize("question", ["hi\x00there", "ab", "x" * 301])
def test_questions_are_plain_text_of_a_sensible_length(
    client: TestClient, me: Signed, question: str
) -> None:
    assert (
        client.post("/v1/ask", json={"question": question}, headers=me.headers).status_code == 422
    )


def test_new_lines_are_fine_in_long_text(client: TestClient, me: Signed) -> None:
    body = {"kind": "cv", "title": "My CV", "content": "Line one\nLine two\tand a tab"}
    assert client.post("/v1/me/drafts", json=body, headers=me.headers).status_code != 422


@pytest.mark.parametrize("name", ["Mrs Dlamini", "P"])
def test_guardian_names_follow_the_name_rule(client: TestClient, me: Signed, name: str) -> None:
    profile(client, me)
    # An adult gets 403 (no approval needed): the name itself was accepted.
    reply = client.post("/v1/me/guardian", json={"guardian_name": name}, headers=me.headers)
    assert reply.status_code != 422


def test_a_guardian_name_with_markup_is_refused(client: TestClient, me: Signed) -> None:
    reply = client.post("/v1/me/guardian", json={"guardian_name": "<script>"}, headers=me.headers)
    assert reply.status_code == 422
