import collections
from datetime import datetime, timedelta
from typing import List, Tuple
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
        return int((dt - self.ref_time).total_seconds() // 60)

    def _mins_to_datetime(self, mins: int) -> datetime:
        return self.ref_time + timedelta(minutes=mins)
        
    def _calculate_horizon(self):
        # Calculate a safe upper bound for the schedule
        max_end = 0
        for task in self.request.tasks:
            t_end = self._datetime_to_mins(task.deadline)
            if t_end > max_end:
                max_end = t_end
        for event in self.request.fixed_events:
            t_end = self._datetime_to_mins(event.end)
            if t_end > max_end:
                max_end = t_end
        # Adding some buffer
        self.horizon_end = max_end + 10000

    def build_model(self):
        intervals = []
        
        # 1. Create variables for each task
        for task in self.request.tasks:
            duration = task.duration_minutes
            
            # Bounds
            min_start = max(0, self._datetime_to_mins(task.earliest_start))
            max_end = min(self.horizon_end, self._datetime_to_mins(task.deadline))
            
            start_var = self.model.NewIntVar(min_start, max_end - duration, f'start_{task.id}')
            end_var = self.model.NewIntVar(min_start + duration, max_end, f'end_{task.id}')
            interval_var = self.model.NewIntervalVar(start_var, duration, end_var, f'interval_{task.id}')
            
            self.task_vars[task.id] = (start_var, end_var, interval_var)
            intervals.append(interval_var)
            
        # 2. Add fixed events
        for event in self.request.fixed_events:
            start_min = self._datetime_to_mins(event.start)
            end_min = self._datetime_to_mins(event.end)
            duration = end_min - start_min
            if duration > 0:
                interval_var = self.model.NewFixedSizeIntervalVar(start_min, duration, f'fixed_{event.id}')
                self.fixed_intervals.append(interval_var)
                intervals.append(interval_var)
                
        # 3. No overlap constraint per resource
        resource_intervals = collections.defaultdict(list)
        for task in self.request.tasks:
            resource_id = getattr(task, 'resource_id', 'default')
            _, _, interval_var = self.task_vars[task.id]
            resource_intervals[resource_id].append(interval_var)
            
        for interval_var in self.fixed_intervals:
            # Assume fixed events block the default resource unless specified
            resource_intervals['default'].append(interval_var)
            
        for res_id, r_intervals in resource_intervals.items():
            if len(r_intervals) > 1:
                self.model.AddNoOverlap(r_intervals)
                
        # 3b. Precedence constraints (if task depends on others)
        for task in self.request.tasks:
            predecessors = getattr(task, 'predecessors', [])
            for pred_id in predecessors:
                if pred_id in self.task_vars:
                    _, pred_end, _ = self.task_vars[pred_id]
                    start_var, _, _ = self.task_vars[task.id]
                    self.model.Add(start_var >= pred_end)

        # 4. Soft preferences (Objective function)
        objective_terms = []
        for task in self.request.tasks:
            start_var, _, _ = self.task_vars[task.id]
            
            if task.preferred_start_before:
                pref_before = self._datetime_to_mins(task.preferred_start_before)
                # penalty = max(0, start_var - pref_before)
                penalty_var = self.model.NewIntVar(0, self.horizon_end, f'penalty_before_{task.id}')
                self.model.AddMaxEquality(penalty_var, [0, start_var - pref_before])
                objective_terms.append(penalty_var * task.priority)
                
            if task.preferred_start_after:
                pref_after = self._datetime_to_mins(task.preferred_start_after)
                # penalty = max(0, pref_after - start_var)
                penalty_var = self.model.NewIntVar(0, self.horizon_end, f'penalty_after_{task.id}')
                self.model.AddMaxEquality(penalty_var, [0, pref_after - start_var])
                objective_terms.append(penalty_var * task.priority)
                
        # Also penalize later completions slightly to push tasks as early as possible
        for task in self.request.tasks:
            _, end_var, _ = self.task_vars[task.id]
            objective_terms.append(end_var)

        self.model.Minimize(sum(objective_terms))

    def solve(self, time_limit_sec: float = 2.0) -> Tuple[str, List[ScheduledTask], float]:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_sec
        
        status = solver.Solve(self.model)
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            scheduled_tasks = []
            for task_id, (start_var, end_var, _) in self.task_vars.items():
                start_val = solver.Value(start_var)
                end_val = solver.Value(end_var)
                
                scheduled_tasks.append(ScheduledTask(
                    task_id=task_id,
                    start=self._mins_to_datetime(start_val),
                    end=self._mins_to_datetime(end_val)
                ))
            return solver.StatusName(status), scheduled_tasks, solver.WallTime() * 1000
        else:
            return solver.StatusName(status), [], solver.WallTime() * 1000

