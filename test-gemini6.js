const GEMINI_API_KEY = "AIzaSyBZnE8eDj8k6DLDTzvLGMloVjS-TsFGSpk";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

const message = "Hola soy el creador de mymsgpro";

fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Eres MymsgAI, un asistente virtual inteligente integrado en la aplicación de chat MyMsg Pro. 
Responde de manera amigable, concisa y muy útil en español. Actúa como una persona o asistente experto.
El usuario te dice: "${message}"`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    }
  })
})
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error("API Error details:", JSON.stringify(data.error, null, 2));
  } else {
    console.log("Success:", data.candidates[0].content.parts[0].text);
  }
})
.catch(err => console.error("Network Error:", err));
