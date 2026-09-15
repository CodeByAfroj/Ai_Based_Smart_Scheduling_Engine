import collections
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Optional, Dict, Any
from zoneinfo import ZoneInfo
from ortools.sat.python import cp_model
from .models import ScheduleRequest, ScheduledTask, FixedEvent


@dataclass
class SolverConfig:
    time_limit_sec: float = 5.0
    num_workers: int = 8
    log_search_progress: bool = False
    objective_weights: Dict[str, float] = field(default_factory=lambda: {
        "preferred_before": 1.0,
        "preferred_after": 1.0,
        "earliness": 0.1,
        "priority_weight": 1.0
    })
    enable_warm_start: bool = True
    return_partial_on_timeout: bool = True


def apply_busy_signal(schedule_request: ScheduleRequest, busy: bool, busy_until: datetime):
    if busy:
        busy_event = FixedEvent(
            id="busy_signal_block",
            name="Busy Activity",
            start=schedule_request.reference_time,
            end=busy_until
        )
        schedule_request.fixed_events.append(busy_event)


class SchedulerEngine:
    def __init__(self, request: ScheduleRequest, config: Optional[SolverConfig] = None):
        self.request = request
        self.config = config or SolverConfig()
        self.model = cp_model.CpModel()
        self.ref_time = request.reference_time

        # We will use minutes as our time unit
        self.task_vars = {}
        self.fixed_intervals = []
        self._prev_solution_hints: Dict[str, Tuple[int, int]] = {}

        self.horizon_end = 0
        self._calculate_horizon()

    def _normalize_dt(self, dt: datetime) -> datetime:
        IST = ZoneInfo("Asia/Kolkata")
        if dt.tzinfo is None:
            return dt.replace(tzinfo=IST)
        return dt.astimezone(IST)

    def _datetime_to_mins(self, dt: datetime) -> int:
        ref_ist = self._normalize_dt(self.ref_time)
        dt_ist = self._normalize_dt(dt)
        return int((dt_ist - ref_ist).total_seconds() // 60)

    def _mins_to_datetime(self, mins: int) -> datetime:
        ref_ist = self._normalize_dt(self.ref_time)
        return ref_ist + timedelta(minutes=mins)

    def _calculate_horizon(self):
        max_end = 0
        for task in self.request.tasks:
            t_end = self._datetime_to_mins(task.deadline)
            if t_end > max_end:
                max_end = t_end
        for event in self.request.fixed_events:
            t_end = self._datetime_to_mins(event.end)
            if t_end > max_end:
                max_end = t_end
        self.horizon_end = max_end + 10000

    def _get_working_windows(self) -> List[Tuple[int, int]]:
        wh = self.request.working_hours
        windows = []
        ref_ist = self._normalize_dt(self.ref_time)
        ref_day_start = ref_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        ref_day_offset = int((ref_day_start - ref_ist).total_seconds() // 60)

        horizon_days = max(7, min(30, (self.horizon_end // (24 * 60)) + 3))
        for day_idx in range(-1, horizon_days + 1):
            day_offset = ref_day_offset + day_idx * 24 * 60
            win_start = day_offset + wh.start_hour * 60
            win_end = day_offset + wh.end_hour * 60

            # If current time is past start_hour on day 0, allow window from max(0, win_start)
            if win_end <= 0 or win_start >= self.horizon_end:
                continue
            win_start_clamped = max(0, win_start)
            win_end_clamped = min(self.horizon_end, win_end)
            if win_end_clamped > win_start_clamped:
                windows.append((win_start_clamped, win_end_clamped))

        return windows

    def set_warm_start_hints(self, previous_schedule: List[ScheduledTask]):
        """
        Set solution hints from a previous schedule to warm-start the solver.
        Call this before build_model() if you have a previous solution.
        """
        self._prev_solution_hints = {}
        for task in previous_schedule:
            start_min = self._datetime_to_mins(task.start)
            end_min = self._datetime_to_mins(task.end)
            self._prev_solution_hints[task.task_id] = (start_min, end_min)

    def build_model(self):
        wh = self.request.working_hours
        working_windows = self._get_working_windows()

        # ── 1. Create variables for each task ──────────────────────────
        all_intervals = []

        for task in self.request.tasks:
            duration = task.duration_minutes

            # Hard bounds from the task's own window
            min_start = max(0, self._datetime_to_mins(task.earliest_start))
            raw_max_end = self._datetime_to_mins(task.deadline)

            # For flexible (non-fixed) tasks, ensure deadline horizon is at least min_start + 3 days to fit work windows
            if not getattr(task, 'fixed', False):
                max_end = max(raw_max_end, min_start + 24 * 60 * 3)
            else:
                max_end = max(raw_max_end, min_start + duration)
            max_end = min(self.horizon_end, max_end)

            # Make sure the window is wide enough
            if max_end - min_start < duration:
                max_end = min_start + duration

            start_var    = self.model.NewIntVar(min_start, max_end - duration, f'start_{task.id}')
            end_var      = self.model.NewIntVar(min_start + duration, max_end,  f'end_{task.id}')
            
            # If task is marked as FIXED, lock start_var to exactly min_start (user specified exact time)
            if getattr(task, 'fixed', False):
                self.model.Add(start_var == min_start)

            interval_var = self.model.NewIntervalVar(start_var, duration, end_var, f'interval_{task.id}')

            self.task_vars[task.id] = (start_var, end_var, interval_var)
            all_intervals.append(interval_var)

            # ── Working-hours & Quiet-hours constraints ────────────────────────
            # Task must fit entirely within at least one working window and OUTSIDE quiet hours.
            if working_windows:
                window_bools = []
                for win_idx, (win_start, win_end) in enumerate(working_windows):
                    if win_end - win_start < duration:
                        continue  # task can't fit in this window anyway

                    fits = self.model.NewBoolVar(f'fits_{task.id}_win{win_idx}')
                    self.model.Add(start_var >= win_start).OnlyEnforceIf(fits)
                    self.model.Add(end_var   <= win_end  ).OnlyEnforceIf(fits)
                    window_bools.append(fits)

                if window_bools:
                    # Task MUST fit into at least one working window
                    self.model.AddBoolOr(window_bools)

            # Explicitly forbid Quiet / Sleep Hours (e.g. 11 PM - 7 AM)
            ref_day_start = self.ref_time.replace(hour=0, minute=0, second=0, microsecond=0)
            ref_day_offset = int((ref_day_start - self.ref_time).total_seconds() // 60)
            horizon_days = min(30, self.horizon_end // (24 * 60) + 2)

            quiet_spans = []
            for day_idx in range(-1, horizon_days + 1):
                day_offset = ref_day_offset + day_idx * 24 * 60
                q_start = day_offset + wh.quiet_start_hour * 60
                q_end = day_offset + (wh.quiet_end_hour + 24) * 60 if wh.quiet_end_hour < wh.quiet_start_hour else day_offset + wh.quiet_end_hour * 60
                if q_end > 0 and q_start < self.horizon_end:
                    quiet_spans.append((q_start, q_end))

            for q_idx, (q_start, q_end) in enumerate(quiet_spans):
                # Ensure task interval [start_var, end_var] does NOT overlap with [q_start, q_end]
                # Either end <= q_start OR start >= q_end
                before_q = self.model.NewBoolVar(f'before_q_{task.id}_{q_idx}')
                after_q = self.model.NewBoolVar(f'after_q_{task.id}_{q_idx}')
                self.model.Add(end_var <= q_start).OnlyEnforceIf(before_q)
                self.model.Add(start_var >= q_end).OnlyEnforceIf(after_q)
                self.model.AddBoolOr([before_q, after_q])

            # Apply warm-start hints if available
            if self.config.enable_warm_start and task.id in self._prev_solution_hints:
                hint_start, hint_end = self._prev_solution_hints[task.id]
                self.model.AddHint(start_var, hint_start)
                self.model.AddHint(end_var, hint_end)

        # ── 2. Add fixed events (with resource support) ────────────────────
        for event in self.request.fixed_events:
            start_min = self._datetime_to_mins(event.start)
            end_min   = self._datetime_to_mins(event.end)
            dur       = end_min - start_min
            if dur > 0:
                iv = self.model.NewFixedSizeIntervalVar(start_min, dur, f'fixed_{event.id}')
                self.fixed_intervals.append(iv)
                all_intervals.append(iv)

        # ── 3. No-overlap per resource ─────────────────────────────────────
        resource_intervals = collections.defaultdict(list)
        for task in self.request.tasks:
            res = getattr(task, 'resource_id', 'default')
            _, _, iv = self.task_vars[task.id]
            resource_intervals[res].append(iv)

        for event in self.request.fixed_events:
            res = getattr(event, 'resource_id', 'default')
            start_min = self._datetime_to_mins(event.start)
            end_min   = self._datetime_to_mins(event.end)
            dur       = end_min - start_min
            if dur > 0:
                iv = self.model.NewFixedSizeIntervalVar(start_min, dur, f'fixed_{event.id}')
                resource_intervals[res].append(iv)

        for res_id, r_ivs in resource_intervals.items():
            if len(r_ivs) > 1:
                self.model.AddNoOverlap(r_ivs)

        # ── 3b. Precedence constraints ─────────────────────────────────────
        for task in self.request.tasks:
            for pred_id in (getattr(task, 'predecessors', []) or []):
                if pred_id in self.task_vars:
                    _, pred_end, _ = self.task_vars[pred_id]
                    start_var, _, _ = self.task_vars[task.id]
                    self.model.Add(start_var >= pred_end)

        # ── 4. Objective (configurable weights & Peak/Quiet energy matching) ─────────
        weights = self.config.objective_weights
        objective_terms = []

        # Calculate peak energy windows for reward term
        ref_day_start = self.ref_time.replace(hour=0, minute=0, second=0, microsecond=0)
        ref_day_offset = int((ref_day_start - self.ref_time).total_seconds() // 60)
        horizon_days = min(30, self.horizon_end // (24 * 60) + 2)

        peak_windows = []
        for day_idx in range(-1, horizon_days + 1):
            day_offset = ref_day_offset + day_idx * 24 * 60
            p_start = day_offset + wh.peak_start_hour * 60
            p_end = day_offset + wh.peak_end_hour * 60
            if p_end > 0 and p_start < self.horizon_end:
                peak_windows.append((max(0, p_start), min(self.horizon_end, p_end)))

        for task in self.request.tasks:
            start_var, end_var, _ = self.task_vars[task.id]
            priority = task.priority * weights.get("priority_weight", 1.0)

            if task.preferred_start_before:
                pref_before = self._datetime_to_mins(task.preferred_start_before)
                penalty_var = self.model.NewIntVar(0, self.horizon_end, f'pb_{task.id}')
                self.model.AddMaxEquality(penalty_var, [0, start_var - pref_before])
                objective_terms.append(penalty_var * priority * weights.get("preferred_before", 1.0))

            if task.preferred_start_after:
                pref_after = self._datetime_to_mins(task.preferred_start_after)
                penalty_var = self.model.NewIntVar(0, self.horizon_end, f'pa_{task.id}')
                self.model.AddMaxEquality(penalty_var, [0, pref_after - start_var])
                objective_terms.append(penalty_var * priority * weights.get("preferred_after", 1.0))

            # Energy Optimization: Reward scheduling inside Peak Windows for ALL tasks
            if peak_windows:
                in_peak_bools = []
                for p_idx, (p_start, p_end) in enumerate(peak_windows):
                    in_p = self.model.NewBoolVar(f'peak_{task.id}_{p_idx}')
                    self.model.Add(start_var >= p_start).OnlyEnforceIf(in_p)
                    self.model.Add(end_var <= p_end).OnlyEnforceIf(in_p)
                    in_peak_bools.append(in_p)
                if in_peak_bools:
                    any_peak = self.model.NewBoolVar(f'any_peak_{task.id}')
                    self.model.AddBoolOr(in_peak_bools).OnlyEnforceIf(any_peak)
                    # Reward peak alignment (scaled by task priority)
                    objective_terms.append(any_peak * -2000 * max(1, task.priority))

            # Penalise later start times heavily so tasks schedule as early as possible in active hours
            objective_terms.append(start_var * 10.0)

        if objective_terms:
            self.model.Minimize(sum(objective_terms))

    def solve(self, time_limit_sec: Optional[float] = None) -> Tuple[str, List[ScheduledTask], float]:
        time_limit = time_limit_sec if time_limit_sec is not None else self.config.time_limit_sec

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit
        solver.parameters.num_search_workers = self.config.num_workers
        solver.parameters.log_search_progress = self.config.log_search_progress

        status = solver.Solve(self.model)

        scheduled_tasks = []
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for task_id, (start_var, end_var, _) in self.task_vars.items():
                start_val = solver.Value(start_var)
                end_val   = solver.Value(end_var)
                scheduled_tasks.append(ScheduledTask(
                    task_id=task_id,
                    start=self._mins_to_datetime(start_val),
                    end=self._mins_to_datetime(end_val),
                ))
            return solver.StatusName(status), scheduled_tasks, solver.WallTime() * 1000

        # Return partial/best-found solution on timeout or if enabled
        if self.config.return_partial_on_timeout and status == cp_model.UNKNOWN:
            # Check if solver found any feasible solution during search
            try:
                # Try to get the best solution found so far
                for task_id, (start_var, end_var, _) in self.task_vars.items():
                    # Use BestSolution() if available, otherwise fall back to Value()
                    start_val = solver.Value(start_var)
                    end_val   = solver.Value(end_var)
                    scheduled_tasks.append(ScheduledTask(
                        task_id=task_id,
                        start=self._mins_to_datetime(start_val),
                        end=self._mins_to_datetime(end_val),
                    ))
                if scheduled_tasks:
                    return "PARTIAL", scheduled_tasks, solver.WallTime() * 1000
            except Exception:
                pass

        return solver.StatusName(status), [], solver.WallTime() * 1000