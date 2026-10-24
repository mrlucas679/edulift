import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.seed import read, write
from tests.test_marks import active
from tests.test_seed import REPO_DATA, dataset

INJECTIONS = [
    "' OR '1'='1",
    "'; DROP TABLE programmes; --",
    '" OR ""="',
    "1 UNION SELECT password FROM users--",
    "%' OR 1=1 --",
    "\\",
    "_%",
    "$(curl evil.example)",
    "<script>alert(1)</script>",
]


@pytest.fixture
def seeded(tmp_path, engine: Engine) -> None:  # type: ignore[no-untyped-def]
    data = read(dataset(tmp_path))
    data.subjects.subjects = read(REPO_DATA).subjects.subjects
    write(engine, data)


@pytest.mark.parametrize("payload", INJECTIONS)
def test_search_treats_injection_as_plain_text(
    client: TestClient, seeded: None, payload: str
) -> None:
    r = client.get("/v1/programmes", params={"q": payload})
    assert r.status_code == 200
    assert r.json()["items"] == []


@pytest.mark.parametrize("payload", INJECTIONS)
def test_filters_treat_injection_as_plain_text(
    client: TestClient, seeded: None, payload: str
) -> None:
    assert client.get("/v1/programmes", params={"field": payload}).status_code == 200
    assert client.get("/v1/programmes", params={"institution": payload}).status_code == 200
    assert client.get("/v1/institutions/" + payload).status_code == 404


@pytest.mark.parametrize("payload", INJECTIONS[:4])
def test_path_ids_cannot_inject(
    client: TestClient, inbox: dict[str, str], seeded: None, payload: str
) -> None:
    s = active(client, inbox, "a@example.org")
    assert client.get(f"/v1/me/applications/{payload}", headers=s.headers).status_code in {404, 422}
    assert client.delete(f"/v1/me/saved/programme/{payload}", headers=s.headers).status_code in {
        204,
        404,
        422,
    }


def test_another_learners_objects_are_not_found_anywhere(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    owner = active(client, inbox, "owner@example.org")
    other = active(client, inbox, "other@example.org")
    app_id = client.post(
        "/v1/me/applications",
        json={"target_kind": "programme", "target_id": "uj.bsc-it"},
        headers=owner.headers,
    ).json()["id"]
    item = client.get(f"/v1/me/applications/{app_id}", headers=owner.headers).json()["checklist"][
        0
    ]["id"]

    probes = [
        client.get(f"/v1/me/applications/{app_id}", headers=other.headers),
        client.patch(f"/v1/me/applications/{app_id}", json={"notes": "x"}, headers=other.headers),
        client.patch(
            f"/v1/me/applications/{app_id}/checklist/{item}?done=true", headers=other.headers
        ),
        client.delete(f"/v1/me/applications/{app_id}", headers=other.headers),
    ]
    assert {p.status_code for p in probes} == {404}


def test_profile_rejects_fields_a_learner_should_not_set(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.put(
        "/v1/me/profile",
        json={"birth_date": "2000-01-01", "status": "active", "user_id": "someone-else"},
        headers=s.headers,
    )
    assert r.status_code == 422


def test_application_create_rejects_unknown_fields(
    client: TestClient, inbox: dict[str, str], seeded: None
) -> None:
    s = active(client, inbox, "a@example.org")
    r = client.post(
        "/v1/me/applications",
        json={
            "target_kind": "programme",
            "target_id": "uj.bsc-it",
            "status": "offer",
            "user_id": "x",
        },
        headers=s.headers,
    )
    assert r.status_code == 422
