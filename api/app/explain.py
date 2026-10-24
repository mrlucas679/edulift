import json
import logging
import re
from dataclasses import asdict, dataclass
from typing import Any, Protocol

from pydantic import BaseModel, Field, ValidationError

log = logging.getLogger(__name__)

MAX_CHARS = 300
OVERSTATED = ("will be accepted", "will get in", "guaranteed", "definitely", "certain to")
SYSTEM_PROMPT = (
    "You explain a university or college eligibility result to a South African learner. "
    "The data is in <data> tags. Use only that data. Do not invent requirements, dates, "
    "fees or numbers. Never say the learner will be accepted. Reply with JSON only: "
    '{"summary": "...", "next_step": "...", "plan_b_hint": "..."}, each under 300 characters.'
)


@dataclass(frozen=True)
class CheckFact:
    name: str
    required: str
    yours: str
    result: str
    source_url: str


@dataclass(frozen=True)
class ExplanationInput:
    outcome: str
    programme: str
    institution: str
    qualification: str
    closes_on: str | None
    checks: list[CheckFact]


class Draft(BaseModel):
    summary: str = Field(max_length=MAX_CHARS)
    next_step: str = Field(max_length=MAX_CHARS)
    plan_b_hint: str = Field(max_length=MAX_CHARS)


class ExplanationProvider(Protocol):
    name: str

    def explain(self, data: ExplanationInput) -> Draft: ...


class TemplateProvider:
    name = "template"

    def explain(self, data: ExplanationInput) -> Draft:
        unmet = [c for c in data.checks if c.result == "fail"]
        unknown = [c for c in data.checks if c.result == "unknown"]
        if data.outcome == "incomplete":
            summary = "Add at least six subjects plus Life Orientation to get a result."
        elif unmet:
            summary = (
                f"{data.programme} needs more than your marks show. See the short checks below."
            )
        elif unknown:
            summary = (
                f"You meet what we could confirm for {data.programme}. "
                "Some checks are not confirmed."
            )
        else:
            summary = f"You meet the published minimums for {data.programme}."
        next_step = (
            "Check the official site for the rest, and confirm with the institution."
            if unknown or data.outcome != "qualifies"
            else "Check the closing date on the official site before you apply."
        )
        plan_b = (
            "Look at the other options listed below."
            if data.outcome != "qualifies"
            else "No other option is needed for this programme."
        )
        return Draft(summary=summary, next_step=next_step, plan_b_hint=plan_b)


class BedrockProvider:
    name = "bedrock"

    def __init__(self, client: Any, model_id: str) -> None:
        self._client = client
        self._model_id = model_id

    def explain(self, data: ExplanationInput) -> Draft:
        payload = json.dumps(asdict(data), ensure_ascii=False)
        response = self._client.converse(
            modelId=self._model_id,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": f"<data>{payload}</data>"}]}],
            inferenceConfig={"maxTokens": 400, "temperature": 0},
        )
        return parse_draft(response["output"]["message"]["content"][0]["text"])


def parse_draft(text: str) -> Draft:
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    try:
        return Draft.model_validate(json.loads(cleaned))
    except (ValueError, ValidationError) as err:
        raise ValueError("reply was not the expected JSON") from err


def reject_reason(draft: Draft, data: ExplanationInput) -> str | None:
    """Why a model reply must not be shown, or None if it may be."""
    text = " ".join([draft.summary, draft.next_step, draft.plan_b_hint])
    if any(phrase in text.lower() for phrase in OVERSTATED):
        return "overstated"
    allowed = set(re.findall(r"\d+", json.dumps(asdict(data), ensure_ascii=False)))
    if set(re.findall(r"\d+", text)) - allowed:
        return "invented_number"
    return None


@dataclass(frozen=True)
class Explained:
    draft: Draft
    provider: str
    fallback_reason: str | None


def explain(
    data: ExplanationInput,
    provider: ExplanationProvider,
    template: TemplateProvider,
) -> Explained:
    """The model's words if they pass; otherwise the template, with the reason recorded."""
    if isinstance(provider, TemplateProvider):
        return Explained(template.explain(data), template.name, None)
    try:
        draft = provider.explain(data)
    except Exception as err:  # noqa: BLE001 - any failure becomes the template, never an error page
        log.warning("explanation provider failed: %s", type(err).__name__)
        return Explained(template.explain(data), template.name, "provider_error")
    reason = reject_reason(draft, data)
    if reason:
        return Explained(template.explain(data), template.name, reason)
    return Explained(draft, provider.name, None)
