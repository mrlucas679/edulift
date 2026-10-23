from fastapi import APIRouter

from app.accounts import ensure_account
from app.deps import Db, SignedIn
from app.schemas import MeResponse

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def read_me(me: SignedIn, db: Db) -> MeResponse:
    account = ensure_account(db, me.subject)
    return MeResponse.model_validate(account, from_attributes=True)
