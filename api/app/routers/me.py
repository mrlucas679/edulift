from fastapi import APIRouter, Response

from app.accounts import ensure_account
from app.deps import Db, Identities, SignedIn
from app.erasure import erase_learner, export_learner, record
from app.schemas import MeResponse

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def read_me(me: SignedIn, db: Db) -> MeResponse:
    account = ensure_account(db, me.subject)
    return MeResponse.model_validate(account, from_attributes=True)


@router.get("/export")
def export(me: SignedIn, db: Db) -> dict[str, object]:
    user = ensure_account(db, me.subject)
    record(db, user.id, "export")
    return export_learner(db, user.id)


@router.delete("", status_code=204)
def delete_account(me: SignedIn, db: Db, identities: Identities) -> Response:
    user = ensure_account(db, me.subject)
    erase_learner(db, identities, user, action="delete")
    return Response(status_code=204)
