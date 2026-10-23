"""Every error: {"error": {"code", "message", "request_id"}}. No stack traces."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.request_id import request_id

logger = logging.getLogger(__name__)


class AppError(Exception):
    code = "internal_error"
    status_code = 500
    message = "Something went wrong on our side. Please try again."


class UnauthenticatedError(AppError):
    code = "unauthenticated"
    status_code = 401
    message = "Please sign in again."


class InvalidCodeError(AppError):
    code = "invalid_code"
    status_code = 400
    message = "That code isn't right. Check the email and try again."


class CodeExpiredError(AppError):
    code = "code_expired"
    status_code = 400
    message = "That code has expired. Ask for a new one."


class RateLimitedError(AppError):
    code = "rate_limited"
    status_code = 429
    message = "Too many tries. Please wait a few minutes and try again."


class UpstreamUnavailableError(AppError):
    code = "upstream_unavailable"
    status_code = 503
    message = "One of our services isn't responding. Please try again shortly."


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "request_id": request_id()}}
    return JSONResponse(status_code=status_code, content=body)


async def _app_error(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        return await _unexpected(request, exc)
    if exc.status_code >= 500:  # noqa: PLR2004
        logger.error("request failed: %s", exc.code, exc_info=exc)
    return error_response(exc.status_code, exc.code, exc.message)


async def _bad_input(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        return await _unexpected(request, exc)
    # Name the fields, never echo the values.
    fields = sorted({".".join(str(p) for p in err["loc"][1:]) or "body" for err in exc.errors()})
    return error_response(422, "validation_failed", "Please check: " + ", ".join(fields))


async def _http_error(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        return await _unexpected(request, exc)
    if exc.status_code == 404:  # noqa: PLR2004
        return error_response(404, "not_found", "We couldn't find that.")
    return error_response(exc.status_code, "not_allowed", "That isn't allowed.")


async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled error", exc_info=exc)
    return error_response(500, AppError.code, AppError.message)


def add_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _bad_input)
    app.add_exception_handler(HTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected)


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404
    message = "We couldn't find that."
