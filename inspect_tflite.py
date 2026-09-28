import tensorflow as tf

def inspect_model(model_path):
    print(f"Inspecting: {model_path}")
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    print("Inputs:")
    for i in input_details:
        print(f"  Name: {i['name']}, Shape: {i['shape']}, Type: {i['dtype']}")
        
    print("Outputs:")
    for o in output_details:
        print(f"  Name: {o['name']}, Shape: {o['shape']}, Type: {o['dtype']}")
    print("-" * 40)

inspect_model("frontend/android/app/src/main/assets/smart_har.tflite")
inspect_model("backend/activity_classifier/model/smart_har_aggressively_enhanced.tflite")
