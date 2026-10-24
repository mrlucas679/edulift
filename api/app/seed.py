"""Load data/*.yaml into the reference tables.

    python -m app.seed ../data

All or nothing: any bad record and nothing is loaded.
"""

import sys
from datetime import date
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from app import models as m
from app.config import Settings
from app.db import new_engine

# Official sites only. Anything else needs a deliberate addition here.
ALLOWED_SUFFIXES = (".ac.za", ".gov.za", ".edu.za")
ALLOWED_HOSTS = {
    "sayouth.mobi",
    "www.agriseta.co.za",
    "www.bankseta.org.za",
    "www.cathsseta.org.za",
    "www.ceta.org.za",
    "www.chieta.org.za",
    "www.etdpseta.org.za",
    "www.ewseta.org.za",
    "www.fasset.org.za",
    "www.foodbev.co.za",
    "www.fpmseta.org.za",
    "www.hwseta.org.za",
    "www.inseta.org.za",
    "www.lgseta.org.za",
    "www.mict.org.za",
    "www.mqa.org.za",
    "www.nsfas.org.za",
    "www.sayouth.mobi",
    "www.servicesseta.org.za",
    "www.teta.org.za",
    "www.wrseta.org.za",
    "www.zabursaries.co.za",
}


def official_url(url: str) -> str:
    parts = urlparse(url)
    host = parts.hostname or ""
    if parts.scheme != "https":
        raise ValueError(f"not https: {url}")
    if host not in ALLOWED_HOSTS and not host.endswith(ALLOWED_SUFFIXES):
        raise ValueError(f"not an allowed domain: {url}")
    return url


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceIn(Strict):
    id: str
    title: str
    url: str
    publisher: str
    checked_on: date | None = None

    _url = field_validator("url")(official_url)


class SubjectIn(Strict):
    id: str
    name: str
    kind: Literal["language", "mathematics", "science", "other"]
    aliases: list[str] = []


class SubjectsFile(Strict):
    source: str
    subjects: list[SubjectIn]


class FieldIn(Strict):
    id: str
    name: str
    parent: str | None = None


class HandoffIn(Strict):
    id: str
    name: str
    purpose: str
    url: str
    source: str

    _url = field_validator("url")(official_url)


class CriterionIn(Strict):
    check: str
    values: list[str] = []
    number: int | None = None


class OpportunityIn(Strict):
    id: str
    name: str
    kind: Literal["bursary", "loan", "learnership", "work"]
    provider: str
    url: str
    field: str | None = None
    closes_on: date | None = None
    criteria: list[CriterionIn] = []
    source: str

    _url = field_validator("url")(official_url)


class CycleIn(Strict):
    intake_year: int
    opens_on: date
    closes_on: date
    source: str

    @model_validator(mode="after")
    def _order(self) -> "CycleIn":
        if self.closes_on < self.opens_on:
            raise ValueError("closes before it opens")
        return self


class OptionIn(Strict):
    subject: str
    min: int


FPS_SCHEMES = {"uct_fps", "uct_science", "uct_health"}


class FloorIn(Strict):
    count: int
    min: int


class NbtIn(Strict):
    component: Literal["AL", "QL", "MAT"]
    level: Literal["basic", "intermediate", "upper_intermediate", "proficient"]


class BandIn(Strict):
    label: Literal["guaranteed", "likely", "possible", "probable"]
    metric: Literal["FPS", "WPS", "FPS_NBT"] = "FPS"
    score: int
    applies_to: Literal["all", "targeted_redress", "international"] = "all"
    requirements: list[list[OptionIn]] = []
    nbt: list[list[NbtIn]] = []


class ProgrammeIn(Strict):
    id: str
    name: str
    qualification: Literal["higher_cert", "diploma", "degree", "extended_degree", "ncv", "n4"]
    field: str
    min_aps: int | None = None
    aps_scheme: Literal["uct_fps", "uct_science", "uct_health", "ukzn_aps"] | None = (
        None  # overrides
    )
    notes: str | None = None  # shown as-is; never judged, e.g. places limits
    floor: FloorIn | None = None
    selection: bool = False
    closes_on: date | None = None
    source: str
    verified_on: date | None = None
    # Each inner list is one group of alternatives; every group must be met.
    requirements: list[list[OptionIn]] = []
    fps_bands: list[BandIn] = []
    nbt: list[list[NbtIn]] = []


class InstitutionIn(Strict):
    id: str
    name: str
    type: Literal["university", "uot", "tvet", "private"]
    province: str
    apply_url: str
    route: Literal["direct", "cao", "cas"]
    fee_cents: int | None = None
    max_choices: int | None = None
    aps_scheme: (
        Literal["standard_best6", "wits_best7", "uct_fps", "uct_science", "uct_health", "ukzn_aps"]
        | None
    ) = None
    source: str
    cycles: list[CycleIn] = []
    programmes: list[ProgrammeIn] = []

    _url = field_validator("apply_url")(official_url)


class Data(BaseModel):
    sources: list[SourceIn]
    subjects: SubjectsFile
    fields: list[FieldIn]
    handoffs: list[HandoffIn]
    opportunities: list[OpportunityIn] = []
    institutions: list[InstitutionIn]

    @model_validator(mode="after")
    def _references(self) -> "Data":
        sources = {s.id for s in self.sources}
        subjects = {s.id for s in self.subjects.subjects}
        fields = {f.id for f in self.fields}
        used = [self.subjects.source, *(h.source for h in self.handoffs)]
        used += [o.source for o in self.opportunities]
        for inst in self.institutions:
            used += [inst.source, *(c.source for c in inst.cycles)]
            for p in inst.programmes:
                used.append(p.source)
                if p.field not in fields:
                    raise ValueError(f"{p.id}: unknown field {p.field}")
                scheme = p.aps_scheme or inst.aps_scheme
                if p.fps_bands and scheme not in FPS_SCHEMES:
                    raise ValueError(f"{p.id}: fps_bands need an FPS scheme")
                groups: list[list[OptionIn]] = [
                    *p.requirements,
                    *(g for b in p.fps_bands for g in b.requirements),
                ]
                for group in groups:
                    for option in group:
                        if option.subject not in subjects:
                            raise ValueError(f"{p.id}: unknown subject {option.subject}")
        for o in self.opportunities:
            if o.field and o.field not in fields:
                raise ValueError(f"{o.id}: unknown field {o.field}")
        if missing := sorted(set(used) - sources):
            raise ValueError(f"unknown sources: {missing}")
        for f in self.fields:
            if f.parent and f.parent not in fields:
                raise ValueError(f"{f.id}: unknown parent {f.parent}")
        return self


def read(folder: Path) -> Data:
    def load(name: str) -> object:
        return yaml.safe_load((folder / name).read_text(encoding="utf-8"))

    return Data(
        sources=load("sources.yaml"),
        subjects=load("subjects.yaml"),
        fields=load("fields.yaml"),
        handoffs=load("handoffs.yaml"),
        opportunities=load("opportunities.yaml")
        if (folder / "opportunities.yaml").exists()
        else [],
        institutions=[
            yaml.safe_load(p.read_text(encoding="utf-8"))
            for p in sorted((folder / "institutions").glob("*.yaml"))
        ],
    )


TABLES = [
    m.FpsBand, m.Requirement, m.Programme, m.Cycle, m.Institution,
    m.Opportunity, m.Handoff, m.Subject, m.Field, m.Source,
]  # fmt: skip


def write(engine: Engine, data: Data) -> None:
    with Session(engine) as db, db.begin():
        for table in TABLES:
            db.execute(delete(table))
        db.add_all(m.Source(**s.model_dump()) for s in data.sources)
        db.flush()
        # Parents before children.
        for f in sorted(data.fields, key=lambda f: f.parent is not None):
            db.add(m.Field(id=f.id, name=f.name, parent_id=f.parent))
            db.flush()
        for s in data.subjects.subjects:
            db.add(m.Subject(**s.model_dump(), source_id=data.subjects.source))
        for h in data.handoffs:
            db.add(m.Handoff(**h.model_dump(exclude={"source"}), source_id=h.source))
        db.flush()
        for o in data.opportunities:
            db.add(
                m.Opportunity(
                    id=o.id,
                    name=o.name,
                    kind=o.kind,
                    provider=o.provider,
                    url=o.url,
                    field_id=o.field,
                    closes_on=o.closes_on,
                    criteria=[c.model_dump() for c in o.criteria],
                    source_id=o.source,
                )
            )
        db.flush()
        for inst in data.institutions:
            _write_institution(db, inst)


def _write_institution(db: Session, inst: InstitutionIn) -> None:
    fields = inst.model_dump(exclude={"source", "cycles", "programmes"})
    db.add(m.Institution(**fields, source_id=inst.source))
    db.flush()
    for c in inst.cycles:
        db.add(
            m.Cycle(**c.model_dump(exclude={"source"}), institution_id=inst.id, source_id=c.source)
        )
    for p in inst.programmes:
        db.add(
            m.Programme(
                **p.model_dump(exclude={"source", "field", "requirements", "fps_bands"}),
                institution_id=inst.id,
                field_id=p.field,
                source_id=p.source,
            )
        )
        db.flush()
        for group_no, group in enumerate(p.requirements, start=1):
            for o in group:
                db.add(
                    m.Requirement(
                        programme_id=p.id,
                        group_no=group_no,
                        subject_id=o.subject,
                        min_percent=o.min,
                    )
                )
        for band in p.fps_bands:
            db.add(
                m.FpsBand(
                    programme_id=p.id,
                    label=band.label,
                    metric=band.metric,
                    score=band.score,
                    applies_to=band.applies_to,
                    requirements=[[o.model_dump() for o in g] for g in band.requirements],
                    nbt=[[n.model_dump() for n in g] for g in band.nbt],
                )
            )


def main() -> None:
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else "../data")
    data = read(folder)
    write(new_engine(Settings().sqlalchemy_url), data)
    print(f"loaded {len(data.institutions)} institutions, {len(data.subjects.subjects)} subjects")


if __name__ == "__main__":
    main()
