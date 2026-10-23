"""Public reference data. No account needed."""

from datetime import date
from itertools import groupby
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app import models as m
from app.deps import Db
from app.errors import NotFoundError
from app.schemas import (
    DeadlineOut,
    FieldOut,
    HandoffOut,
    InstitutionDetail,
    InstitutionOut,
    MetaOut,
    OptionOut,
    Page,
    ProgrammeDetail,
    ProgrammeOut,
    SubjectOut,
)

router = APIRouter(tags=["reference"])


@router.get("/subjects")
def subjects(db: Db) -> list[SubjectOut]:
    rows = db.scalars(select(m.Subject).order_by(m.Subject.name))
    return [SubjectOut.model_validate(r) for r in rows]


@router.get("/fields")
def fields(db: Db) -> list[FieldOut]:
    rows = db.scalars(select(m.Field).order_by(m.Field.id))
    return [FieldOut.model_validate(r) for r in rows]


@router.get("/institutions")
def institutions(
    db: Db,
    province: Annotated[str | None, Query(max_length=30)] = None,
    type: Annotated[str | None, Query(max_length=20)] = None,
) -> list[InstitutionOut]:
    q = select(m.Institution).order_by(m.Institution.name)
    if province:
        q = q.where(m.Institution.province == province)
    if type:
        q = q.where(m.Institution.type == type)
    return [InstitutionOut.model_validate(r) for r in db.scalars(q)]


@router.get("/institutions/{institution_id}")
def institution(institution_id: str, db: Db) -> InstitutionDetail:
    row = db.get(m.Institution, institution_id)
    if row is None:
        raise NotFoundError
    return InstitutionDetail.model_validate(row)


@router.get("/programmes")
def programmes(
    db: Db,
    *,
    q: Annotated[str | None, Query(max_length=80)] = None,
    field: Annotated[str | None, Query(max_length=60)] = None,
    institution: Annotated[str | None, Query(max_length=40)] = None,
    qualification: Annotated[str | None, Query(max_length=20)] = None,
    page: Annotated[int, Query(ge=1, le=1000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> Page[ProgrammeOut]:
    query = select(m.Programme)
    if q:
        query = query.where(m.Programme.name.ilike(f"%{_escape_like(q)}%", escape="\\"))
    if field:
        # A parent field matches its children too: "it" finds "it.software".
        query = query.where(
            or_(m.Programme.field_id == field, m.Programme.field_id.startswith(f"{field}."))
        )
    if institution:
        query = query.where(m.Programme.institution_id == institution)
    if qualification:
        query = query.where(m.Programme.qualification == qualification)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(m.Programme.name).offset((page - 1) * page_size).limit(page_size)
    )
    items = [ProgrammeOut.model_validate(r) for r in rows]
    return Page(items=items, page=page, page_size=page_size, total=total)


@router.get("/programmes/{programme_id}")
def programme(programme_id: str, db: Db) -> ProgrammeDetail:
    row = db.get(m.Programme, programme_id)
    if row is None:
        raise NotFoundError
    groups = [
        [OptionOut(subject_id=r.subject_id, min_percent=r.min_percent) for r in group]
        for _, group in groupby(row.requirements, key=lambda r: r.group_no)
    ]
    return ProgrammeDetail(
        **ProgrammeOut.model_validate(row).model_dump(),
        closes_on=row.closes_on,
        verified=row.verified_on is not None,
        source=row.source,
        requirement_groups=groups,
    )


@router.get("/deadlines")
def deadlines(db: Db, limit: Annotated[int, Query(ge=1, le=20)] = 6) -> list[DeadlineOut]:
    today = date.today()
    rows = db.execute(
        select(m.Cycle, m.Institution.name)
        .join(m.Institution)
        .where(m.Cycle.closes_on >= today)
        .order_by(m.Cycle.closes_on)
        .limit(limit)
    )
    return [
        DeadlineOut(
            institution_id=c.institution_id,
            institution=name,
            intake_year=c.intake_year,
            closes_on=c.closes_on,
            days_left=(c.closes_on - today).days,
        )
        for c, name in rows
    ]


@router.get("/handoffs")
def handoffs(db: Db) -> list[HandoffOut]:
    return [
        HandoffOut.model_validate(r) for r in db.scalars(select(m.Handoff).order_by(m.Handoff.name))
    ]


@router.get("/meta")
def meta(db: Db) -> MetaOut:
    last = db.scalar(select(func.max(m.Source.checked_on)))
    unchecked = db.scalar(select(func.count()).where(m.Source.checked_on.is_(None))) or 0
    return MetaOut(last_checked=last, unchecked_sources=unchecked)


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
