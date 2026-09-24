with open('frontend/android/app/build.gradle', 'r') as f:
    content = f.read()

content = content.replace(
    '    implementation project(\':capacitor-cordova-android-plugins\')',
    '    implementation project(\':capacitor-cordova-android-plugins\')\n    implementation "org.tensorflow:tensorflow-lite:2.14.0"'
)

content = content.replace(
    '    defaultConfig {\n        applicationId "com.taskpulse.app"',
    '    aaptOptions {\n        noCompress "tflite"\n    }\n    defaultConfig {\n        applicationId "com.taskpulse.app"'
)

with open('frontend/android/app/build.gradle', 'w') as f:
    f.write(content)
