// MymsgAI - Intelligent chatbot
import { containsBannedWord } from "./censor";

export async function getMymsgAIResponse(message: string): Promise<string> {
  // Check if message contains inappropriate content
  if (containsBannedWord(message)) {
    return "Lo siento, soy una IA y no puedo responderte eso.";
  }

  const lowerMessage = message.toLowerCase().trim();

  // Math questions
  if (lowerMessage.includes("cuánto") || lowerMessage.includes("cuanto") || lowerMessage.includes("resultado")) {
    // Simple math evaluation
    try {
      const mathMatch = message.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
      if (mathMatch) {
        const [, num1Str, operator, num2Str] = mathMatch;
        const num1 = parseInt(num1Str);
        const num2 = parseInt(num2Str);
        let result: number;
        
        switch (operator) {
          case '+': result = num1 + num2; break;
          case '-': result = num1 - num2; break;
          case '*': result = num1 * num2; break;
          case '/': result = num1 / num2; break;
          default: result = 0;
        }
        
        return `El resultado es: ${result}`;
      }
    } catch (e) {
      return "No pude entender la operación matemática.";
    }
  }

  // Greetings
  if (lowerMessage.match(/^(hola|hi|hey|buenos días|buenas tardes|buenas noches)/i)) {
    const greetings = [
      "¡Hola! Soy MymsgAI, tu asistente inteligente. ¿En qué puedo ayudarte?",
      "¡Saludos! Estoy aquí para responder preguntas, resolver problemas matemáticos y más.",
      "¡Bienvenido! Soy MymsgAI. Cuéntame, ¿qué necesitas?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Questions about who I am
  if (lowerMessage.match(/quién eres|qué eres|quién soy|cómo te llamas/i)) {
    return "Soy MymsgAI, una inteligencia artificial diseñada para ayudarte. Puedo responder preguntas, resolver problemas matemáticos, ayudarte con información general y mucho más. ¿Hay algo específico en lo que pueda ayudarte?";
  }

  // Questions about time/date
  if (lowerMessage.match(/qué hora|qué día|qué fecha/i)) {
    const now = new Date();
    const time = now.toLocaleTimeString('es-ES');
    const date = now.toLocaleDateString('es-ES');
    return `La hora actual es ${time} y la fecha es ${date}.`;
  }

  // Questions about capabilities
  if (lowerMessage.match(/qué puedes|puedes ayudar|qué sabes/i)) {
    return "Puedo:\n• Responder preguntas generales\n• Resolver problemas matemáticos\n• Proporcionar información\n• Mantener conversaciones\n• Ayudarte con dudas\n\n¿Hay algo en lo que pueda ayudarte?";
  }

  // General knowledge responses
  const generalAnswers: { [key: string]: string } = {
    "capital de españa": "Madrid es la capital de España.",
    "capital de méxico": "México es la capital de México.",
    "capital de france": "París es la capital de Francia.",
    "capital de italia": "Roma es la capital de Italia.",
    "capital de alemania": "Berlín es la capital de Alemania.",
    "capital de gran bretaña": "Londres es la capital del Reino Unido.",
    "capital de japón": "Tokio es la capital de Japón.",
    "capital de china": "Pekín es la capital de China.",
    "planeta más grande": "Júpiter es el planeta más grande de nuestro sistema solar.",
    "planeta más cercano al sol": "Mercurio es el planeta más cercano al sol.",
    "océano más grande": "El Océano Pacífico es el océano más grande.",
    "montaña más alta": "El Monte Everest es la montaña más alta del mundo.",
    "país más grande": "Rusia es el país más grande del mundo.",
    "río más largo": "El río Nilo es el río más largo del mundo.",
    "animal más rápido": "El halcón peregrino es el animal más rápido.",
    "animal más grande": "La ballena azul es el animal más grande del mundo.",
  };

  // Check general knowledge
  for (const [key, answer] of Object.entries(generalAnswers)) {
    if (lowerMessage.includes(key)) {
      return answer;
    }
  }

  // Science questions
  if (lowerMessage.includes("agua") && (lowerMessage.includes("fórmula") || lowerMessage.includes("formula"))) {
    return "La fórmula química del agua es H₂O (dos átomos de hidrógeno y uno de oxígeno).";
  }

  if (lowerMessage.includes("oxígeno") && (lowerMessage.includes("elemento") || lowerMessage.includes("símbolo"))) {
    return "El oxígeno es un elemento químico con símbolo O y número atómico 8.";
  }

  if (lowerMessage.includes("velocidad") && lowerMessage.includes("luz")) {
    return "La velocidad de la luz es aproximadamente 300,000 km/s o 3 × 10⁸ m/s.";
  }

  // How are you
  if (lowerMessage.match(/cómo estás|cómo está|cómo te va/i)) {
    return "¡Estoy funcionando perfectamente! Como soy una IA, siempre estoy listo para ayudarte. ¿Hay algo que necesites?";
  }

  // Help request
  if (lowerMessage.match(/ayuda|help|necesito/i)) {
    return "Claro, estoy aquí para ayudarte. Puedo responder preguntas, resolver problemas matemáticos, darte información sobre geografía, ciencia y mucho más. ¿Qué necesitas?";
  }

  // Default response for unknown questions
  const defaultResponses = [
    "Esa es una pregunta interesante. Aunque no tengo una respuesta específica, puedo intentar ayudarte de otra manera. ¿Puedes preguntarme algo más?",
    "No tengo una respuesta directa para eso, pero estoy aprendiendo constantemente. ¿Hay algo más en lo que pueda ayudarte?",
    "Esa pregunta es un poco complicada. Si la reformulas o me das más contexto, podré ayudarte mejor.",
    "Interesante pregunta. ¿Puedes darme más detalles para poder asistirte mejor?",
  ];

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}
