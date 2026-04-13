from datetime import date, datetime

from pydantic import BaseModel


class WeeklyReportResponse(BaseModel):
    id: int
    user_id: int
    week_start: date
    status: str
    content: str | None
    error_msg: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
