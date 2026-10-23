from pathlib import Path
from typing import Any

import pytest
import yaml
from pydantic import ValidationError
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app import models as m
from app.seed import read, write

REPO_DATA = Path(__file__).parents[2] / "data"


def dataset(tmp_path: Path, **changes: Any) -> Path:
    files: dict[str, Any] = {
        "sources.yaml": [
            {"id": "s", "title": "T", "url": "https://www.uj.ac.za/", "publisher": "UJ"}
        ],
        "subjects.yaml": {
            "source": "s",
            "subjects": [{"id": "mathematics", "name": "Mathematics", "kind": "mathematics"}],
        },
        "fields.yaml": [{"id": "it", "name": "IT"}],
        "handoffs.yaml": [],
        "institutions/uj.yaml": {
            "id": "uj",
            "name": "UJ",
            "type": "university",
            "province": "Gauteng",
            "apply_url": "https://www.uj.ac.za/",
            "route": "direct",
            "source": "s",
            "cycles": [
                {
                    "intake_year": 2027,
                    "opens_on": "2026-04-01",
                    "closes_on": "2026-10-31",
                    "source": "s",
                }
            ],
            "programmes": [
                {
                    "id": "uj.bsc-it",
                    "name": "BSc IT",
                    "qualification": "degree",
                    "field": "it",
                    "min_aps": 30,
                    "source": "s",
                    "requirements": [[{"subject": "mathematics", "min": 60}]],
                }
            ],
        },
    }
    files.update(changes)
    for name, content in files.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.safe_dump(content), encoding="utf-8")
    return tmp_path


def test_repo_data_is_valid() -> None:
    assert read(REPO_DATA).institutions


def test_loads_everything(tmp_path: Path, engine: Engine) -> None:
    write(engine, read(dataset(tmp_path)))
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(m.Programme)) == 1
        req = db.scalars(select(m.Requirement)).one()
        assert (req.group_no, req.subject_id, req.min_percent) == (1, "mathematics", 60)


def test_reload_replaces_rather_than_duplicates(tmp_path: Path, engine: Engine) -> None:
    data = read(dataset(tmp_path))
    write(engine, data)
    write(engine, data)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(m.Institution)) == 1


@pytest.mark.parametrize(
    "url",
    ["http://www.uj.ac.za/", "https://uniapplyforme.co.za/", "https://uj.ac.za.evil.com/"],
)
def test_rejects_unofficial_or_insecure_urls(tmp_path: Path, url: str) -> None:
    sources = [{"id": "s", "title": "T", "url": url, "publisher": "X"}]
    with pytest.raises(ValidationError, match="url"):
        read(dataset(tmp_path, **{"sources.yaml": sources}))


def test_rejects_unknown_source(tmp_path: Path) -> None:
    handoffs = [
        {
            "id": "h",
            "name": "H",
            "purpose": "p",
            "url": "https://www.dpsa.gov.za/",
            "source": "nope",
        }
    ]
    with pytest.raises(ValidationError, match="unknown sources"):
        read(dataset(tmp_path, **{"handoffs.yaml": handoffs}))


def test_rejects_window_that_closes_before_it_opens(tmp_path: Path) -> None:
    inst = yaml.safe_load((dataset(tmp_path) / "institutions/uj.yaml").read_text())
    inst["cycles"][0]["closes_on"] = "2026-01-01"
    with pytest.raises(ValidationError, match="closes before it opens"):
        read(dataset(tmp_path, **{"institutions/uj.yaml": inst}))


def test_rejects_unknown_subject_in_requirements(tmp_path: Path) -> None:
    inst = yaml.safe_load((dataset(tmp_path) / "institutions/uj.yaml").read_text())
    inst["programmes"][0]["requirements"] = [[{"subject": "physics", "min": 50}]]
    with pytest.raises(ValidationError, match="unknown subject"):
        read(dataset(tmp_path, **{"institutions/uj.yaml": inst}))


def test_bad_data_leaves_the_database_alone(tmp_path: Path, engine: Engine) -> None:
    write(engine, read(dataset(tmp_path)))
    broken = read(dataset(tmp_path))
    broken.institutions[0].programmes[0].field = "missing"  # bypasses validation
    with pytest.raises(Exception, match="programmes"):
        write(engine, broken)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(m.Programme)) == 1
