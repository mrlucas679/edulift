from fastapi import APIRouter

from app.accounts import get_or_create_account
from app.dependencies import Db, SignedIn
from app.schemas import MeResponse

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def read_me(me: SignedIn, db: Db) -> MeResponse:
    account = get_or_create_account(db, me.subject)
    return MeResponse.model_validate(account, from_attributes=True)
