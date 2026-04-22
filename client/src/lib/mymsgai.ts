// MymsgAI - Intelligent chatbot powered by Google Gemini
import { containsBannedWord } from "./censor";

const GEMINI_API_KEY = "AIzaSyBZnE8eDj8k6DLDTzvLGMloVjS-TsFGSpk";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function getMymsgAIResponse(message: string): Promise<string> {
  // Check if message contains inappropriate content
  if (containsBannedWord(message)) {
    return "Lo siento, soy una IA y no puedo responderte eso por políticas de seguridad.";
  }

  try {
    const response = await fetch(API_URL, {
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
    });

    if (!response.ok) {
      console.error("Gemini API error:", await response.text());
      return "Lo siento, estoy teniendo problemas de conexión en este momento. ¿Podrías intentar más tarde?";
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      return "No pude procesar una respuesta adecuada. ¿Podrías reformular tu pregunta?";
    }
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Ocurrió un error al intentar conectarme a mi cerebro. Por favor, inténtalo de nuevo.";
  }
}
