import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, model_validator


class Request(BaseModel):
    # Reject unknown fields.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# Shared input rules: say what is allowed, and refuse the rest (OWASP input validation).
# Messages name the rule and never repeat what was typed.
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Letters in any language, single spaces, apostrophes or hyphens between them.
# \u2019 is the curly apostrophe phones type.
_NAME = re.compile(r"[^\W\d_]+(?:[ '\u2019-][^\W\d_]+)*")
NAME_RULE = "Use letters, spaces, apostrophes and hyphens only, like Mary-Jane or O'Neil."


def _plain_text(value: str) -> str:
    if _CONTROL.search(value):
        raise ValueError("Remove hidden characters (they can come from copying and pasting).")
    return value


def _name(value: str) -> str:
    if not _NAME.fullmatch(value):
        raise ValueError(NAME_RULE)
    return value


# Ids of courses, bursaries, subjects and fields: lower case, as in data/.
Id = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9._-]{0,79}$")]
Text = Annotated[str, AfterValidator(_plain_text)]
Name = Annotated[str, AfterValidator(_name)]
Province = Literal[
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape", "Western Cape",
]  # fmt: skip
# Whole numbers only: "60" or 60.5 is refused, not quietly turned into 60.
Marks = dict[Id, Annotated[int, Field(ge=0, le=100, strict=True)]]
OLDEST_BIRTH = date(1900, 1, 1)


USERNAME = r"^[A-Za-z0-9._]{3,30}$"
# Sign-in passwords are only length-checked here; new ones get the full rules in passwords.py.
Password = Annotated[str, Field(min_length=1, max_length=128)]


class Credentials(Request):
    username: str = Field(pattern=USERNAME)
    password: Password
    # Web: keep the refresh token in an HttpOnly cookie instead of the reply.
    use_cookie: bool = False


class RecoverRequest(Request):
    username: str = Field(pattern=USERNAME)
    code: str = Field(pattern=r"^[A-Za-z0-9 -]{12,20}$")
    new_password: Password
    use_cookie: bool = False


class RefreshRequest(Request):
    # Empty when the web app sends the cookie instead.
    refresh_token: str | None = Field(default=None, min_length=1, max_length=200)
    use_cookie: bool = False


class SignOutRequest(Request):
    refresh_token: str | None = Field(default=None, min_length=1, max_length=200)


class ChangePasswordRequest(Request):
    current_password: Password
    new_password: Password
    use_cookie: bool = False


class NewCodesRequest(Request):
    current_password: Password


class RecoveryCodes(BaseModel):
    recovery_codes: list[str]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None
    expires_in: int
    token_type: Literal["Bearer"] = "Bearer"  # noqa: S105


class NewAccount(TokenResponse):
    # Shown once. Only their hashes are kept.
    recovery_codes: list[str]


class MeResponse(BaseModel):
    id: str
    status: Literal["onboarding", "pending_guardian", "active", "restricted"]
    created_at: datetime


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]


# Reference data (public)


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SourceOut(Out):
    title: str
    url: str
    publisher: str
    checked_on: date | None


class SubjectOut(Out):
    id: str
    name: str
    kind: str
    aliases: list[str]


class FieldOut(Out):
    id: str
    name: str
    parent_id: str | None


class CycleOut(Out):
    intake_year: int
    opens_on: date
    closes_on: date
    source: SourceOut


class InstitutionOut(Out):
    id: str
    name: str
    type: str
    province: str
    apply_url: str
    route: str


class InstitutionDetail(InstitutionOut):
    fee_cents: int | None
    max_choices: int | None
    aps_scheme: str | None
    source: SourceOut
    cycles: list[CycleOut]


class ProgrammeOut(Out):
    id: str
    name: str
    institution_id: str
    qualification: str
    field_id: str
    min_aps: int | None
    selection: bool


class OptionOut(BaseModel):
    subject_id: str
    min_percent: int


class ProgrammeDetail(ProgrammeOut):
    closes_on: date | None
    verified: bool
    source: SourceOut
    # Each group is a list of alternatives; every group must be met.
    requirement_groups: list[list[OptionOut]]


class Page[T](BaseModel):
    items: list[T]
    page: int
    page_size: int
    total: int


class DeadlineOut(BaseModel):
    institution_id: str
    institution: str
    intake_year: int
    closes_on: date
    days_left: int


class HandoffOut(Out):
    id: str
    name: str
    purpose: str
    url: str


class MetaOut(BaseModel):
    last_checked: date | None
    unchecked_sources: int


class PreviewRequest(Request):
    # subject id -> percent
    marks: Marks = Field(min_length=1, max_length=15)


class PreviewScore(BaseModel):
    institution_id: str
    institution: str
    scheme: str | None
    score: int | None  # None: scheme not verified, check the institution's site


class CheckOut(BaseModel):
    name: str
    required: str
    yours: str
    result: Literal["pass", "fail", "unknown"]
    source_url: str
    checked_on: date | None  # None: the source has not been checked yet


class VerdictOut(BaseModel):
    programme_id: str
    outcome: str
    score: int | None
    scheme: str | None
    window: str
    checks: list[CheckOut]
    note: str = "Based on published minimums. The institution decides."


# Onboarding

Purpose = Literal[
    "account", "ai_explanations", "ai_writing", "reminders", "nbt_results", "low_data"
]


class ProfileIn(Request):
    first_name: Name | None = Field(default=None, min_length=1, max_length=60)
    birth_date: date
    province: Province | None = None
    certificate: Literal["nsc", "ieb", "sacai"] | None = None
    interests: list[Id] | None = Field(default=None, max_length=3)

    @model_validator(mode="after")
    def _check(self) -> "ProfileIn":
        if not OLDEST_BIRTH <= self.birth_date <= date.today():
            raise ValueError("Check your birthday: use day, month and a 4-digit year.")
        if self.interests is not None and len(set(self.interests)) != len(self.interests):
            raise ValueError("pick each interest once")
        return self


class ConsentRequest(Request):
    purpose: Purpose
    granted: bool
    # Required with the reminders purpose: where reminder emails go.
    contact_email: EmailStr | None = Field(default=None, max_length=254)


class MeDetail(BaseModel):
    id: str
    status: Literal["onboarding", "pending_guardian", "active", "restricted"]
    created_at: datetime
    first_name: str | None
    birth_date: date | None
    province: str | None = None
    certificate: str | None = None
    consents: list[str]
    reconfirm: list[str]  # guardian choices the learner must confirm at 18
    interests: list[str]


class GuardianRequestIn(Request):
    guardian_name: Name = Field(min_length=1, max_length=80)


class GuardianLink(BaseModel):
    # The learner shares this with their parent or guardian; it works once, for 72 hours.
    link: str


class GuardianView(BaseModel):
    learner_first_name: str
    guardian_name: str
    optional_purposes: list[str]


class GuardianDecision(Request):
    decision: Literal["approve", "decline"]
    relationship: Literal["parent", "legal_guardian"] | None = None
    declaration: bool = False
    purposes: list[Purpose] = []

    @model_validator(mode="after")
    def _approve_needs_declaration(self) -> "GuardianDecision":
        if self.decision == "approve" and not (self.declaration and self.relationship):
            raise ValueError("approving needs the declaration and your relationship")
        return self


class MarksIn(Request):
    marks: Marks = Field(min_length=1, max_length=15)


class CheckRequest(Request):
    # Leave out to use your saved marks.
    marks: Marks | None = Field(default=None, max_length=15)


# My plan

PLAN_LIMIT = 3


class PlanIn(Request):
    programme_ids: list[Id] = Field(max_length=PLAN_LIMIT)

    @model_validator(mode="after")
    def unique_targets(self) -> "PlanIn":
        if len(set(self.programme_ids)) != len(self.programme_ids):
            raise ValueError("each programme can be on the plan once")
        return self


class PlanTargetOut(BaseModel):
    programme_id: str
    name: str
    institution: str
    verdict: VerdictOut | None  # None until marks are saved


class PlanOut(BaseModel):
    targets: list[PlanTargetOut]
    limit: int = PLAN_LIMIT


# Plan B


class RouteItemOut(ProgrammeOut):
    # "closed" means applications for this intake have closed.
    window: str


class RouteOut(BaseModel):
    key: str
    title: str
    items: list[RouteItemOut]
    empty_reason: str


class AlternativesOut(BaseModel):
    # All empty when the programme itself already qualifies.
    routes: list[RouteOut]
    funding: list["MatchedOpportunityOut"]
    work: list["MatchedOpportunityOut"]


# Funding and work


class OpportunityOut(Out):
    id: str
    name: str
    kind: str
    provider: str
    url: str
    closes_on: date | None
    source: SourceOut


class CriterionOut(BaseModel):
    check: str
    status: Literal["met", "not_met", "unknown"]


class MatchedOpportunityOut(OpportunityOut):
    # "may_qualify" means some criteria are unknown: confirm with the provider.
    verdict: Literal["qualifies", "may_qualify", "not_checked"]
    checks: list[CriterionOut]
