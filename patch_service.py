with open('frontend/android/app/src/main/java/com/taskpulse/app/TaskMonitorService.java', 'r') as f:
    content = f.read()

content = content.replace('HeuristicActivityTracker', 'SmartHarTracker')

with open('frontend/android/app/src/main/java/com/taskpulse/app/TaskMonitorService.java', 'w') as f:
    f.write(content)
