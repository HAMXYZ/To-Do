"""Type definitions and TypedDicts for FocusFlow AI Backend."""

from typing import TypedDict, Optional, List, Any
from datetime import datetime

class UserDict(TypedDict, total=False):
    id: int
    email: str
    name: Optional[str]
    is_active: bool

class TaskDict(TypedDict, total=False):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    time: str
    deadline_at: Optional[datetime]
    estimated_minutes: Optional[int]
    priority: Optional[str]
    category_id: Optional[int]
    done: bool
    ai: bool
    starred: bool

class HabitDict(TypedDict, total=False):
    id: int
    user_id: int
    title: str
    frequency: str
    days: List[int]
    time: str
    auto_task: bool
    active: bool

class AIPlanStepDict(TypedDict):
    id: int
    title: str
    day: int
    time: str
    starred: bool
    steps: List[str]

class PrioritySuggestionDict(TypedDict):
    task_id: int
    title: str
    due_date: Optional[str]
    day: int
    time: str
    currently_starred: bool
    recommended_star: bool
    score: int
    reason: str
