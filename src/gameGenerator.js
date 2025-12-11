const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const systemPrompt = `You are an expert game developer. 
Create a single, self-contained HTML file for a browser-based game. 
The game should be simple but playable. 
Include all CSS and JavaScript within the HTML file. 
Do not use external resources (images, sounds) unless they are generated via code (e.g., Canvas API, Web Audio API) or data URIs.
The game should fit within a 800x600 container but be responsive if possible.
Focus on the gameplay mechanics described by the user.
If the user specifies a genre, adhere to it.
Ensure the code is bug-free and handles errors gracefully.
Return ONLY the HTML code, starting with <!DOCTYPE html> and ending with </html>. Do not wrap it in markdown code blocks.`;

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt
});

async function generateGame(prompt, type) {
    const userPrompt = `Create a ${type || 'browser'} game based on this description: "${prompt}".`;

    try {
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        let content = response.text();
        
        // Clean up markdown code blocks if present, just in case
        content = content.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
        
        return content;
    } catch (error) {
        console.error("Google AI API Error:", error);
        throw new Error("Failed to generate game code.");
    }
}

module.exports = { generateGame };
