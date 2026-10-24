from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.explain import (
    CheckFact,
    Draft,
    ExplanationInput,
    TemplateProvider,
    explain,
    parse_draft,
    reject_reason,
)
from app.seed import read, write
from tests.test_marks import THANDI, active
from tests.test_seed import REPO_DATA, dataset

DATA = ExplanationInput(
    outcome="aps_only",
    programme="BSc IT",
    institution="UJ",
    qualification="degree",
    closes_on="2026-10-31",
    checks=[
        CheckFact("subjects_1", "Mathematics 60%", "Mathematics 45%", "fail", "https://uj.ac.za")
    ],
)


def draft(**texts: str) -> Draft:
    base = {
        "summary": "Your score is enough.",
        "next_step": "Check the site.",
        "plan_b_hint": "See options.",
    }
    return Draft(**{**base, **texts})


class FakeProvider:
    name = "bedrock"

    def __init__(self, reply: Draft | Exception) -> None:
        self.reply = reply
        self.calls = 0

    def explain(self, data: ExplanationInput) -> Draft:
        self.calls += 1
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def test_a_plain_reply_is_accepted() -> None:
    assert reject_reason(draft(), DATA) is None


def test_an_invented_number_is_rejected() -> None:
    assert reject_reason(draft(summary="You need 75%."), DATA) == "invented_number"


def test_a_date_in_the_input_is_fine() -> None:
    assert reject_reason(draft(next_step="Close on 2026-10-31."), DATA) is None


def test_overstated_chances_are_rejected() -> None:
    assert reject_reason(draft(summary="You will be accepted."), DATA) == "overstated"


def test_a_reply_that_is_not_json_is_an_error() -> None:
    with pytest.raises(ValueError):
        parse_draft("sure, here you go")


def test_a_fenced_json_reply_is_read() -> None:
    text = '```json\n{"summary": "a", "next_step": "b", "plan_b_hint": "c"}\n```'
    assert parse_draft(text).summary == "a"


def test_provider_failure_falls_back_to_the_template() -> None:
    result = explain(DATA, FakeProvider(TimeoutError()), TemplateProvider())
    assert (result.provider, result.fallback_reason) == ("template", "provider_error")


def test_invented_number_falls_back_to_the_template() -> None:
    result = explain(DATA, FakeProvider(draft(summary="You need 90%.")), TemplateProvider())
    assert (result.provider, result.fallback_reason) == ("template", "invented_number")


def test_a_valid_reply_is_used() -> None:
    result = explain(DATA, FakeProvider(draft()), TemplateProvider())
    assert (result.provider, result.fallback_reason) == ("bedrock", None)


@pytest.fixture
def seeded(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


def ai_consent(client: TestClient, s: object) -> None:
    client.post(
        "/v1/me/consents",
        json={"purpose": "ai_explanations", "granted": True},
        headers=s.headers,  # type: ignore[attr-defined]
    )


def test_without_consent_the_model_is_never_called(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    fake = FakeProvider(draft())
    client.app.state.explainer = fake  # type: ignore[attr-defined]
    body = client.post(
        "/v1/programmes/uj.bsc-it/explain", json={"marks": THANDI}, headers=s.headers
    ).json()
    assert fake.calls == 0
    assert body["provider"] == "template"
    assert body["fallback_reason"] == "no_consent"


def test_with_consent_a_valid_reply_is_shown(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    ai_consent(client, s)
    client.app.state.explainer = FakeProvider(draft())  # type: ignore[attr-defined]
    body = client.post(
        "/v1/programmes/uj.bsc-it/explain", json={"marks": THANDI}, headers=s.headers
    ).json()
    assert body["provider"] == "bedrock"
    assert body["summary"] == "Your score is enough."


def test_a_bad_reply_never_reaches_the_learner(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    ai_consent(client, s)
    client.app.state.explainer = FakeProvider(draft(summary="You will be accepted."))  # type: ignore[attr-defined]
    body = client.post(
        "/v1/programmes/uj.bsc-it/explain", json={"marks": THANDI}, headers=s.headers
    ).json()
    assert body["provider"] == "template"
    assert "accepted" not in body["summary"].lower()
    assert body["fallback_reason"] == "overstated"
