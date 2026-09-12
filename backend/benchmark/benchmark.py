import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from datetime import datetime, timedelta
from app.models import ScheduleRequest, Task
from app.engine import SchedulerEngine
from taillard_parser import load_taillard_instance

def run_benchmark(instance_name, best_known):
    num_jobs, num_machines, times, machines = load_taillard_instance(instance_name)
    
    tasks = []
    ref_time = datetime(2025, 1, 1, 8, 0)
    
    # We set a loose deadline for all jobs
    loose_deadline = ref_time + timedelta(hours=10000)
    
    # Create tasks
    for i in range(num_jobs):
        prev_task_id = None
        for j in range(num_machines):
            duration = times[i][j]
            machine_id = machines[i][j]
            
            task_id = f"job_{i}_op_{j}"
            
            task = Task(
                id=task_id,
                name=task_id,
                duration_minutes=duration,
                earliest_start=ref_time,
                deadline=loose_deadline,
                priority=1,
                resource_id=machine_id,
                predecessors=[prev_task_id] if prev_task_id else []
            )
            tasks.append(task)
            prev_task_id = task_id
            
    request = ScheduleRequest(
        tasks=tasks,
        fixed_events=[],
        reference_time=ref_time
    )
    
    engine = SchedulerEngine(request)
    engine.build_model()
    
    # We give it 5 seconds per instance for quick benchmarking
    status, scheduled_tasks, solve_time_ms = engine.solve(time_limit_sec=5.0)
    
    if status in ["OPTIMAL", "FEASIBLE"] and scheduled_tasks:
        makespan = max((t.end - ref_time).total_seconds() / 60 for t in scheduled_tasks)
        gap = ((makespan - best_known) / best_known) * 100
        print(f"[{instance_name}] Status: {status:<8} | Makespan: {makespan:<6} | Best Known: {best_known:<6} | Gap: {gap:>5.2f}% | Time: {solve_time_ms:.0f}ms")
    else:
        print(f"[{instance_name}] Status: {status}")

if __name__ == "__main__":
    # Best known values for Taillard instances
    # https://github.com/tamy0612/JSPLIB
    instances = [
        ("ta01", 1231),
        ("ta02", 1244),
        ("ta03", 1218),
        ("ta04", 1175),
        ("ta05", 1224)
    ]
    print("Running Taillard Job Shop Benchmarks...")
    print("-" * 80)
    for inst, best in instances:
        try:
            run_benchmark(inst, best)
        except Exception as e:
            print(f"[{inst}] Error: {e}")
