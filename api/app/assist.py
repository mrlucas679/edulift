import json
import logging
import re
from dataclasses import asdict, dataclass
from typing import Protocol

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import models as m

log = logging.getLogger(__name__)

MAX_ANSWER = 300
MAX_FACTS = 3000
MAX_MARK = 100
KHETHA_HANDOFF = "khetha"
REFUSAL = "I can't answer that from EduLift's data. Khetha can help."
ELIGIBILITY = re.compile(r"\b(qualify|eligib|accepted|get in|get into|admi(t|ssion))\b", re.I)
VERDICT_WORDS = (
    "you qualify",
    "you will be",
    "you don't qualify",
    "you do not qualify",
    "you meet",
)
SA_ID = re.compile(r"\b\d{13}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(\+27|0)[\d \-]{8,12}\d")


@dataclass(frozen=True)
class Record:
    id: str
    title: str
    facts: list[str]
    url: str | None


class Answer(BaseModel):
    answer: str = Field(max_length=MAX_ANSWER)
    cited_ids: list[str]


class AskProvider(Protocol):
    name: str

    def answer(self, question: str, records: list[Record]) -> Answer: ...


class TemplateAsk:
    name = "template"

    def answer(self, question: str, records: list[Record]) -> Answer:
        if not records:
            return Answer(answer=REFUSAL, cited_ids=[])
        first = records[0]
        return Answer(answer=f"{first.title}: " + "; ".join(first.facts[:3]), cited_ids=[first.id])


def retrieve(db: Session, question: str, limit: int = 8) -> list[Record]:
    """Records whose titles or facts share a word with the question. Top results only."""
    words = [w for w in re.findall(r"[a-zA-Z]{4,}", question.lower())][:6]
    if not words:
        return []
    records: list[Record] = []
    for programme in db.scalars(
        select(m.Programme)
        .where(or_(*[m.Programme.name.ilike(f"%{w}%") for w in words]))
        .limit(limit)
    ):
        institution = db.get_one(m.Institution, programme.institution_id)
        records.append(
            Record(
                id=f"programme:{programme.id}",
                title=programme.name,
                facts=[f"{institution.name}", f"qualification: {programme.qualification}"],
                url=institution.apply_url,
            )
        )
    for opportunity in db.scalars(
        select(m.Opportunity)
        .where(or_(*[m.Opportunity.name.ilike(f"%{w}%") for w in words]))
        .limit(limit)
    ):
        records.append(
            Record(
                id=f"opportunity:{opportunity.id}",
                title=opportunity.name,
                facts=[f"{opportunity.kind} from {opportunity.provider}"],
                url=opportunity.url,
            )
        )
    return records[:limit]


def reject_reason(answer: Answer, question: str, records: list[Record]) -> str | None:
    retrieved = {r.id for r in records}
    if not set(answer.cited_ids) <= retrieved:
        return "uncited_id"
    numbers_in_records = set(re.findall(r"\d+", json.dumps([asdict(r) for r in records])))
    if set(re.findall(r"\d+", answer.answer)) - numbers_in_records:
        return "invented_number"
    if any(v in answer.answer.lower() for v in VERDICT_WORDS):
        return "verdict"
    return None


def ask(
    question: str, records: list[Record], provider: AskProvider
) -> tuple[Answer, str, str | None]:
    """Returns the answer, who produced it, and why the template was used if it was."""
    if ELIGIBILITY.search(question):
        return (
            Answer(
                answer="For whether you qualify, open the programme and check your result there.",
                cited_ids=[],
            ),
            "template",
            "eligibility",
        )
    if isinstance(provider, TemplateAsk):
        return provider.answer(question, records), provider.name, None
    try:
        reply = provider.answer(question, records)
    except Exception as err:  # noqa: BLE001 - any failure becomes the template
        log.warning("ask provider failed: %s", type(err).__name__)
        return TemplateAsk().answer(question, records), "template", "provider_error"
    reason = reject_reason(reply, question, records)
    if reason:
        return TemplateAsk().answer(question, records), "template", reason
    return reply, provider.name, None


def strip_identifiers(text: str) -> str:
    text = SA_ID.sub("[removed]", text)
    text = EMAIL.sub("[removed]", text)
    return PHONE.sub("[removed]", text)


class DraftProvider(Protocol):
    name: str

    def draft(self, kind: str, facts: str, marks: dict[str, int]) -> str: ...


class TemplateDraft:
    name = "template"

    def draft(self, kind: str, facts: str, marks: dict[str, int]) -> str:
        heading = "Curriculum vitae" if kind == "cv" else "Motivation letter"
        marks_line = ", ".join(f"{s} {p}%" for s, p in sorted(marks.items())) or "none saved"
        return f"{heading}\n\n{facts}\n\nSubjects and marks: {marks_line}"


def draft_reject_reason(text: str, marks: dict[str, int], facts: str) -> str | None:
    allowed = {str(p) for p in marks.values()} | set(re.findall(r"\d+", facts))
    numbers = {n for n in re.findall(r"\d+", text) if int(n) <= MAX_MARK}
    if numbers - allowed:
        return "invented_mark"
    return None


def generate_draft(
    kind: str, facts: str, marks: dict[str, int], provider: DraftProvider
) -> tuple[str, str, str | None]:
    """Returns the draft, who wrote it, and why the template was used if it was."""
    cleaned = strip_identifiers(facts)[:MAX_FACTS]
    template = TemplateDraft()
    if isinstance(provider, TemplateDraft):
        return template.draft(kind, cleaned, marks), template.name, None
    try:
        text = provider.draft(kind, cleaned, marks)
    except Exception as err:  # noqa: BLE001 - any failure becomes the template
        log.warning("draft provider failed: %s", type(err).__name__)
        return template.draft(kind, cleaned, marks), template.name, "provider_error"
    reason = draft_reject_reason(text, marks, cleaned)
    if reason:
        return template.draft(kind, cleaned, marks), template.name, reason
    return text, provider.name, None


def converse(client: object, model_id: str, system: str, text: str) -> str:
    """One Bedrock Converse call. The learner's words go in as data, never as instructions."""
    response = client.converse(  # type: ignore[attr-defined]
        modelId=model_id,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": f"<data>{text}</data>"}]}],
        inferenceConfig={"maxTokens": 600, "temperature": 0},
    )
    return str(response["output"]["message"]["content"][0]["text"])


ASK_SYSTEM = (
    "Answer the question using only the records in <data>. Cite the ids of the records you "
    "used. Do not invent numbers or dates. Never say whether the learner qualifies. Reply "
    'with JSON only: {"answer": "...", "cited_ids": ["..."]}, the answer under 300 characters.'
)
DRAFT_SYSTEM = (
    "Write a short CV or motivation letter in English using only the facts in <data>. Do not "
    "add marks, qualifications or dates that are not there. Reply with the text only."
)


class BedrockAsk:
    name = "bedrock"

    def __init__(self, client: object, model_id: str) -> None:
        self._client = client
        self._model_id = model_id

    def answer(self, question: str, records: list[Record]) -> Answer:
        payload = json.dumps(
            {"question": question, "records": [asdict(r) for r in records]}, ensure_ascii=False
        )
        text = converse(self._client, self._model_id, ASK_SYSTEM, payload)
        try:
            return Answer.model_validate(
                json.loads(text.strip().removeprefix("```json").removesuffix("```"))
            )
        except (ValueError, ValidationError) as err:
            raise ValueError("reply was not the expected JSON") from err


class BedrockDraft:
    name = "bedrock"

    def __init__(self, client: object, model_id: str) -> None:
        self._client = client
        self._model_id = model_id

    def draft(self, kind: str, facts: str, marks: dict[str, int]) -> str:
        payload = json.dumps({"kind": kind, "facts": facts, "marks": marks}, ensure_ascii=False)
        return converse(self._client, self._model_id, DRAFT_SYSTEM, payload)
