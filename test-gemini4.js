const GEMINI_API_KEY = "AIzaSyBZnE8eDj8k6DLDTzvLGMloVjS-TsFGSpk";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Hola" }] }]
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
