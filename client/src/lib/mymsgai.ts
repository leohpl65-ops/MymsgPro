// MymsgAI - Intelligent chatbot powered by Google Gemini
import { containsBannedWord } from "./censor";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function getMymsgAIResponse(message: string): Promise<string> {
  // Check if message contains inappropriate content
  if (containsBannedWord(message)) {
    return "Lo siento, soy una IA y no puedo responderte eso por políticas de seguridad.";
  }

  // Handle mathematical equations directly
  const isMathEquation = /^[0-9\+\-\*\/\(\)\.\s]+$/.test(message.trim());
  if (isMathEquation && message.trim().length > 2) {
    try {
      // Usar Function en lugar de eval por seguridad, aunque eval funciona para mates simples
      const result = new Function(`return ${message.trim()}`)();
      return `El resultado de ${message.trim()} es: ${result}`;
    } catch (e) {
      // Si falla, pasarlo a Gemini
    }
  }

  // Handle "resuelve" or "calcula" text + math
  const mathMatch = message.match(/(?:resuelve|calcula|cuanto es|cuánto es)\s+([0-9\+\-\*\/\(\)\.\s]+)/i);
  if (mathMatch && mathMatch[1].trim().length > 2) {
    try {
      const result = new Function(`return ${mathMatch[1].trim()}`)();
      return `El resultado es: ${result}`;
    } catch (e) {
      // Si falla, pasarlo a Gemini
    }
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
