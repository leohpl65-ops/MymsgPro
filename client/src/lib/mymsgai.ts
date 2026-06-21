import { containsBannedWord } from "./censor";

export async function getMymsgAIResponse(message: string): Promise<string> {
  // Check if message contains inappropriate content
  if (containsBannedWord(message)) {
    return "Lo siento, soy una IA y no puedo responderte eso por políticas de seguridad.";
  }

  // Command for image generation
  if (message.trim().toLowerCase().startsWith('/image')) {
    const prompt = message.substring(6).trim();
    if (!prompt) {
      return "No tengo la información suficiente. Usa /image seguido de una descripción, por ejemplo: /image un perro volando";
    }
    // Return a special marker string to generate an image
    return `[IMAGE_URL:https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=800&nologo=true]`;
  }

  // Handle mathematical equations directly
  const isMathEquation = /^[0-9\+\-\*\/\(\)\.\s]+$/.test(message.trim());
  if (isMathEquation && message.trim().length > 2) {
    try {
      const result = new Function(`return ${message.trim()}`)();
      return `El resultado de ${message.trim()} es: ${result}`;
    } catch (e) {}
  }

  const mathMatch = message.match(/(?:resuelve|calcula|cuanto es|cuánto es)\s+([0-9\+\-\*\/\(\)\.\s]+)/i);
  if (mathMatch && mathMatch[1].trim().length > 2) {
    try {
      const result = new Function(`return ${mathMatch[1].trim()}`)();
      return `El resultado es: ${result}`;
    } catch (e) {}
  }

  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
  if (!OPENAI_API_KEY) {
    return "¡Hola! Para que mi cerebro (ChatGPT) funcione, necesitas agregar la variable de entorno 'VITE_OPENAI_API_KEY' en la configuración de tu proyecto.";
  }

  const API_URL = "https://api.openai.com/v1/chat/completions";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // O puedes usar gpt-3.5-turbo si prefieres
        messages: [
          {
            role: "system",
            content: "Eres MymsgAI, un asistente virtual inteligente integrado en la aplicación de chat MyMsg Pro. Responde de manera amigable, concisa y muy útil en español. Actúa como una persona o asistente experto."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      if (response.status === 401 || response.status === 403) {
        return "Parece que la clave de API (VITE_OPENAI_API_KEY) no es válida o ha expirado. Por favor verifica tu clave en OpenAI.";
      } else if (response.status === 429) {
        return "Al parecer te has quedado sin saldo o créditos en tu cuenta de OpenAI. Revisa la facturación.";
      }
      return "Lo siento, estoy teniendo problemas de conexión en este momento. ¿Podrías intentar más tarde?";
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      return "No pude procesar una respuesta adecuada. ¿Podrías reformular tu pregunta?";
    }
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return "Ocurrió un error al intentar conectarme a mi cerebro. Por favor, inténtalo de nuevo.";
  }
}
