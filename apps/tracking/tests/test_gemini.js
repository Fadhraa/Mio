const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const apiKey = process.env.GEMINI_API_KEY;
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Halo, perkenalkan dirimu singkat 1 kalimat." }] }]
  })
})
  .then(async (r) => {
    const json = await r.json();
    if (r.ok) {
      console.log("GEMINI 3.5 FLASH SUCCESS:", json.candidates[0].content.parts[0].text.trim());
      process.exit(0);
    } else {
      console.error("ERROR:", r.status, json);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("ERR:", err.message);
    process.exit(1);
  });
