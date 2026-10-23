import uuid
from contextvars import ContextVar

# We make the id ourselves rather than trusting a header, so nobody can plant text
# in our logs through it.
_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def new_request_id() -> str:
    value = uuid.uuid4().hex
    _request_id.set(value)
    return value


def current_request_id() -> str:
    return _request_id.get()
