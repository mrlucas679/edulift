from typing import Any

import pytest
from botocore.exceptions import ClientError

from app.bedrock import FallbackClient


class Fake:
    def __init__(self, fail_with: str | None) -> None:
        self.fail_with = fail_with
        self.models: list[str] = []

    def converse(self, **kwargs: Any) -> str:
        self.models.append(kwargs["modelId"])
        if self.fail_with and len(self.models) == 1:
            raise ClientError({"Error": {"Code": self.fail_with, "Message": "x"}}, "Converse")
        return "ok"


def test_a_busy_model_falls_back_once() -> None:
    fake = Fake("ServiceUnavailableException")
    assert FallbackClient(fake, "backup").converse(modelId="main") == "ok"
    assert fake.models == ["main", "backup"]


def test_bad_input_is_not_retried_on_another_model() -> None:
    fake = Fake("ValidationException")
    with pytest.raises(ClientError):
        FallbackClient(fake, "backup").converse(modelId="main")
    assert fake.models == ["main"]


def test_no_fallback_set_means_no_retry() -> None:
    fake = Fake("ThrottlingException")
    with pytest.raises(ClientError):
        FallbackClient(fake, "").converse(modelId="main")
