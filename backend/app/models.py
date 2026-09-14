from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class Task(BaseModel):
    id: str
    name: str
    duration_minutes: int
    earliest_start: datetime
    deadline: datetime
    priority: int = 1
    fixed: bool = False
    preferred_start_after: Optional[datetime] = None
    preferred_start_before: Optional[datetime] = None
    resource_id: Optional[str] = "default"
    predecessors: Optional[List[str]] = []

class FixedEvent(BaseModel):
    id: str
    name: str
    start: datetime
    end: datetime
    resource_id: Optional[str] = "default"

class WorkingHours(BaseModel):
    start_hour: int = Field(9, ge=0, le=23)
    end_hour: int = Field(21, ge=0, le=24)
    peak_start_hour: int = Field(9, ge=0, le=23)
    peak_end_hour: int = Field(13, ge=0, le=24)
    quiet_start_hour: int = Field(23, ge=0, le=23)
    quiet_end_hour: int = Field(7, ge=0, le=24)

class ScheduleRequest(BaseModel):
    tasks: List[Task]
    fixed_events: List[FixedEvent] = []
    working_hours: WorkingHours = WorkingHours()
    reference_time: datetime

class ScheduledTask(BaseModel):
    task_id: str
    start: datetime
    end: datetime

class ScheduleResponse(BaseModel):
    status: str
    solve_time_ms: float
    tasks: List[ScheduledTask]
    message: Optional[str] = None
