import collections
from datetime import datetime, timedelta, timezone
from typing import List, Tuple
from zoneinfo import ZoneInfo
from ortools.sat.python import cp_model
from .models import ScheduleRequest, ScheduledTask, FixedEvent


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
    def __init__(self, request: ScheduleRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.ref_time = request.reference_time

        # We will use minutes as our time unit
        self.task_vars = {}
        self.fixed_intervals = []

        self.horizon_end = 0
        self._calculate_horizon()

    def _datetime_to_mins(self, dt: datetime) -> int:
        # Convert both times to IST for consistent calculation
        IST = ZoneInfo("Asia/Kolkata")
        
        # Handle reference time
        if self.ref_time.tzinfo is None:
            # Ref is naive - assume it's UTC time
            ref_ist = self.ref_time.replace(tzinfo=timezone.utc).astimezone(IST)
        else:
            # Ref is already timezone-aware - convert to IST
            ref_ist = self.ref_time.astimezone(IST)
        
        # Handle input time
        if dt.tzinfo is None:
            # DT is naive - assume it's UTC time
            dt_ist = dt.replace(tzinfo=timezone.utc).astimezone(IST)
        else:
            # DT is already timezone-aware - convert to IST
            dt_ist = dt.astimezone(IST)
        
        # Calculate difference in IST
        return int((dt_ist - ref_ist).total_seconds() // 60)

    def _mins_to_datetime(self, mins: int) -> datetime:
        # Result should be in IST
        IST = ZoneInfo("Asia/Kolkata")
        # Convert reference time to IST
        if self.ref_time.tzinfo is None:
            # Ref is naive - assume it's IST time
            ref_ist = self.ref_time.replace(tzinfo=IST)
        else:
            # Ref is already timezone-aware - convert to IST
            ref_ist = self.ref_time.astimezone(IST)
        
        # Add minutes and return in IST
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

    def _working_window_for_day(self, day_offset_mins: int) -> Tuple[int, int]:
        """
        Given a day's offset from ref_time (in minutes), return the
        [window_start_mins, window_end_mins] for the working hours on that day.
        day_offset_mins is the number of minutes from ref_time to the START of that calendar day.
        """
        wh = self.request.working_hours
        day_start = day_offset_mins + wh.start_hour * 60
        day_end   = day_offset_mins + wh.end_hour   * 60
        return day_start, day_end

    def _get_day_offsets(self) -> List[int]:
        """
        Return the set of days (as minute offsets from ref_time to midnight of each day)
        that fall within the scheduling horizon, so we can enforce working-hour windows.
        """
        # Determine which calendar day ref_time falls on
        ref_day = self.ref_time.replace(hour=0, minute=0, second=0, microsecond=0)
        day_offsets = []
        # Cover up to 30 days (well beyond any reasonable horizon)
        horizon_days = min(30, self.horizon_end // (24 * 60) + 2)
        for i in range(-1, horizon_days + 1):
            day_dt = ref_day + timedelta(days=i)
            offset_mins = int((day_dt - self.ref_time).total_seconds() // 60)
            day_offsets.append(offset_mins)
        return day_offsets

    def build_model(self):
        wh = self.request.working_hours
        day_offsets = self._get_day_offsets()

        # ── 1. Create variables for each task ──────────────────────────
        all_intervals = []

        for task in self.request.tasks:
            duration = task.duration_minutes

            # Hard bounds from the task's own window
            min_start = max(0, self._datetime_to_mins(task.earliest_start))
            max_end   = min(self.horizon_end, self._datetime_to_mins(task.deadline))

            # Make sure the window is wide enough
            if max_end - min_start < duration:
                # Widen slightly to allow feasibility check to fail gracefully
                max_end = min_start + duration

            start_var    = self.model.NewIntVar(min_start, max_end - duration, f'start_{task.id}')
            end_var      = self.model.NewIntVar(min_start + duration, max_end,  f'end_{task.id}')
            interval_var = self.model.NewIntervalVar(start_var, duration, end_var, f'interval_{task.id}')

            self.task_vars[task.id] = (start_var, end_var, interval_var)
            all_intervals.append(interval_var)

            # ── Working-hours constraint ────────────────────────────────
            # For each calendar day, tasks must start and end within the
            # working window if they fall on that day. We express this with
            # a disjunction: either the task is entirely before this day's
            # window ends OR entirely after its window starts (i.e. it fits
            # inside the window on some day).
            #
            # Simpler & more robust approach: enumerate day windows and add
            # a boolean "fits in this window" variable, then require that
            # at least one is true.
            window_bools = []
            for day_off in day_offsets:
                win_start, win_end = self._working_window_for_day(day_off)
                if win_end <= 0 or win_start >= self.horizon_end:
                    continue
                if win_end - win_start < duration:
                    continue   # task can't fit in this window anyway

                fits = self.model.NewBoolVar(f'fits_{task.id}_day{day_off}')
                # If fits==1: start_var >= win_start AND end_var <= win_end
                self.model.Add(start_var >= win_start).OnlyEnforceIf(fits)
                self.model.Add(end_var   <= win_end  ).OnlyEnforceIf(fits)
                window_bools.append(fits)

            if window_bools:
                # Task MUST fit into at least one working window
                self.model.AddBoolOr(window_bools)

        # ── 2. Add fixed events (no working-hours restriction) ──────────
        for event in self.request.fixed_events:
            start_min = self._datetime_to_mins(event.start)
            end_min   = self._datetime_to_mins(event.end)
            dur       = end_min - start_min
            if dur > 0:
                iv = self.model.NewFixedSizeIntervalVar(start_min, dur, f'fixed_{event.id}')
                self.fixed_intervals.append(iv)
                all_intervals.append(iv)

        # ── 3. No-overlap per resource ──────────────────────────────────
        resource_intervals = collections.defaultdict(list)
        for task in self.request.tasks:
            res = getattr(task, 'resource_id', 'default')
            _, _, iv = self.task_vars[task.id]
            resource_intervals[res].append(iv)

        for iv in self.fixed_intervals:
            resource_intervals['default'].append(iv)

        for res_id, r_ivs in resource_intervals.items():
            if len(r_ivs) > 1:
                self.model.AddNoOverlap(r_ivs)

        # ── 3b. Precedence constraints ──────────────────────────────────
        for task in self.request.tasks:
            for pred_id in (getattr(task, 'predecessors', []) or []):
                if pred_id in self.task_vars:
                    _, pred_end, _ = self.task_vars[pred_id]
                    start_var, _, _ = self.task_vars[task.id]
                    self.model.Add(start_var >= pred_end)

        # ── 4. Objective ────────────────────────────────────────────────
        objective_terms = []
        for task in self.request.tasks:
            start_var, end_var, _ = self.task_vars[task.id]

            if task.preferred_start_before:
                pref_before = self._datetime_to_mins(task.preferred_start_before)
                penalty_var = self.model.NewIntVar(0, self.horizon_end, f'pb_{task.id}')
                self.model.AddMaxEquality(penalty_var, [0, start_var - pref_before])
                objective_terms.append(penalty_var * task.priority)

            if task.preferred_start_after:
                pref_after = self._datetime_to_mins(task.preferred_start_after)
                penalty_var = self.model.NewIntVar(0, self.horizon_end, f'pa_{task.id}')
                self.model.AddMaxEquality(penalty_var, [0, pref_after - start_var])
                objective_terms.append(penalty_var * task.priority)

            # Penalise later completions slightly (prefer earlier scheduling within window)
            objective_terms.append(end_var)

        if objective_terms:
            self.model.Minimize(sum(objective_terms))

    def solve(self, time_limit_sec: float = 5.0) -> Tuple[str, List[ScheduledTask], float]:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_sec

        status = solver.Solve(self.model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            scheduled_tasks = []
            for task_id, (start_var, end_var, _) in self.task_vars.items():
                start_val = solver.Value(start_var)
                end_val   = solver.Value(end_var)
                scheduled_tasks.append(ScheduledTask(
                    task_id=task_id,
                    start=self._mins_to_datetime(start_val),
                    end=self._mins_to_datetime(end_val),
                ))
            return solver.StatusName(status), scheduled_tasks, solver.WallTime() * 1000
        else:
            return solver.StatusName(status), [], solver.WallTime() * 1000