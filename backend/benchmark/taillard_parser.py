import urllib.request
import json
import os

def load_taillard_instance(name="ta01"):
    url = f"https://raw.githubusercontent.com/tamy0612/JSPLIB/master/instances/{name}"
    response = urllib.request.urlopen(url)
    lines = [line.decode('utf-8').strip() for line in response.readlines() if line.decode('utf-8').strip()]
    
    parts = lines[0].split()
    num_jobs = int(parts[0])
    num_machines = int(parts[1])
    
    times = []
    machines = []
    
    for i in range(1, num_jobs + 1):
        job_data = list(map(int, lines[i].split()))
        job_machines = []
        job_times = []
        for j in range(0, len(job_data), 2):
            job_machines.append(f"m_{job_data[j]}")
            job_times.append(job_data[j+1])
        machines.append(job_machines)
        times.append(job_times)
        
    return num_jobs, num_machines, times, machines

if __name__ == "__main__":
    j, m, t, mach = load_taillard_instance("ta01")
    print(f"Jobs: {j}, Machines: {m}")
    print("First job times:", t[0])
    print("First job machines:", mach[0])
