"""A Bedrock client that tries a second model when the first one is busy or unavailable."""

from typing import Any

from botocore.exceptions import ClientError

# AWS-side capacity errors: worth one try on another model, unlike bad input.
BUSY = {"ServiceUnavailableException", "ThrottlingException", "ModelNotReadyException"}


class FallbackClient:
    def __init__(self, client: Any, fallback_model_id: str) -> None:
        self._client = client
        self._fallback = fallback_model_id

    def converse(self, **kwargs: Any) -> Any:
        try:
            return self._client.converse(**kwargs)
        except ClientError as err:
            if not self._fallback or err.response.get("Error", {}).get("Code") not in BUSY:
                raise
            return self._client.converse(**{**kwargs, "modelId": self._fallback})
