const fs = require('fs');
const path = require('path');
// const fetch = require('node-fetch'); // Built-in in Node 18+

async function generateThumbnail(prompt, outputPath) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const model = 'imagen-3.0-generate-001'; // Using 3.0 as it is often more widely available in beta, or we can try 4.0-fast
    // Let's try the fast one from the list
    const modelName = 'imagen-4.0-fast-generate-001';
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

    const payload = {
        instances: [
            {
                prompt: `A pixel art style thumbnail for a browser game about: ${prompt}. Colorful, engaging, retro game style.`
            }
        ],
        parameters: {
            sampleCount: 1,
            aspectRatio: "4:3"
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image generation failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // The response structure for predict usually contains 'predictions'
        // predictions: [ { bytesBase64Encoded: "..." } ] or similar
        // For Generative AI API it might be slightly different, let's assume standard predict response
        
        if (data.predictions && data.predictions.length > 0) {
            const base64Image = data.predictions[0].bytesBase64Encoded;
            if (base64Image) {
                const buffer = Buffer.from(base64Image, 'base64');
                fs.writeFileSync(outputPath, buffer);
                return true;
            }
        }
        
        console.error("Unexpected image response structure:", JSON.stringify(data).substring(0, 200));
        return false;

    } catch (error) {
        console.error("Thumbnail generation error:", error);
        // Create a placeholder if generation fails?
        // For now just return false
        return false;
    }
}

module.exports = { generateThumbnail };
