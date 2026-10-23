"""JSON logs, one line per event, each tagged with the request id.

House rule: never hand a logger marks, names, emails, birth dates or tokens.
tests/test_errors_and_logs.py checks the output for exactly that.
"""

import json
import logging
from datetime import UTC, datetime

from app.request_id import current_request_id


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        line: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": current_request_id(),
        }
        if isinstance(fields := getattr(record, "fields", None), dict):
            line.update(fields)
        if record.exc_info:
            line["exception"] = self.formatException(record.exc_info)
        return json.dumps(line, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
