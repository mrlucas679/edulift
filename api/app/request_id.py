import uuid
from contextvars import ContextVar

# Generated here, never taken from a header.
_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def new_id() -> str:
    value = uuid.uuid4().hex
    _request_id.set(value)
    return value


def request_id() -> str:
    return _request_id.get()
