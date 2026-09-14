import { useState } from "react";

function VoiceButton() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("🎤 Listening...");
      setListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");

      setText(transcript);

      console.log("📝 Speech:", transcript);
    };

    recognition.onerror = (event) => {
      console.error("❌ Speech error:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      console.log("🛑 Listening stopped");
      setListening(false);
    };

    recognition.start();
  };

  return (
    <div>
      <button onClick={startListening}>
        {listening ? "🔴 Listening..." : "🎤 Speak"}
      </button>

      <p>{text}</p>
    </div>
  );
}

export default VoiceButton;