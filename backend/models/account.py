from typing import Literal

from pydantic import BaseModel


class PurgeAccountRequest(BaseModel):
    confirmation: Literal["DELETE"]
