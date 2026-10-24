import pytest
from fastapi.testclient import TestClient

from tests.conftest import Session as Signed
from tests.test_marks import active


def with_nbt(client: TestClient, s: Signed, granted: bool = True) -> None:
    client.post(
        "/v1/me/consents",
        json={"purpose": "nbt_results", "granted": granted},
        headers=s.headers,
    )


@pytest.fixture
def learner(client: TestClient, inbox: dict[str, str]) -> Signed:
    return active(client, inbox, "nbt@example.org")


def test_nbt_needs_the_optional_purpose(client: TestClient, learner: Signed) -> None:
    r = client.put("/v1/me/nbt/AL", json={"level": "proficient"}, headers=learner.headers)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "consent_required"


def test_save_read_and_remove(client: TestClient, learner: Signed) -> None:
    with_nbt(client, learner)
    r = client.put("/v1/me/nbt/AL", json={"level": "proficient"}, headers=learner.headers)
    assert r.status_code == 200
    client.put("/v1/me/nbt/QL", json={"level": "intermediate"}, headers=learner.headers)
    assert client.get("/v1/me/nbt", headers=learner.headers).json() == {
        "AL": "proficient",
        "QL": "intermediate",
    }
    assert client.delete("/v1/me/nbt/AL", headers=learner.headers).status_code == 204
    assert client.get("/v1/me/nbt", headers=learner.headers).json() == {"QL": "intermediate"}


def test_bad_component_or_level_is_refused(client: TestClient, learner: Signed) -> None:
    with_nbt(client, learner)
    bad_component = client.put("/v1/me/nbt/XX", json={"level": "basic"}, headers=learner.headers)
    bad_level = client.put("/v1/me/nbt/AL", json={"level": "excellent"}, headers=learner.headers)
    assert bad_component.status_code == 422
    assert bad_level.status_code == 422


def test_nbt_is_private(client: TestClient, inbox: dict[str, str], learner: Signed) -> None:
    other = active(client, inbox, "other@example.org")
    with_nbt(client, learner)
    with_nbt(client, other)
    client.put("/v1/me/nbt/AL", json={"level": "proficient"}, headers=learner.headers)
    assert client.get("/v1/me/nbt", headers=other.headers).json() == {}


def test_withdrawing_deletes_the_levels(client: TestClient, learner: Signed) -> None:
    with_nbt(client, learner)
    client.put("/v1/me/nbt/AL", json={"level": "proficient"}, headers=learner.headers)
    with_nbt(client, learner, granted=False)
    with_nbt(client, learner)
    assert client.get("/v1/me/nbt", headers=learner.headers).json() == {}


def test_export_includes_nbt_and_erase_removes_it(client: TestClient, learner: Signed) -> None:
    with_nbt(client, learner)
    client.put("/v1/me/nbt/AL", json={"level": "proficient"}, headers=learner.headers)
    export = client.get("/v1/me/export", headers=learner.headers).json()
    assert export["nbt"] == {"AL": "proficient"}
