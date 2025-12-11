require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const gameGenerator = require('./src/gameGenerator');
const imageGenerator = require('./src/imageGenerator');
const tags = require('./src/tags');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const app = express();
const PORT = process.env.PORT || 3000;
const GAMES_FILE = path.join(__dirname, 'data', 'games.json');

// Helper to get random tags
function getRandomTags(count = 3) {
    const shuffled = tags.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Helper to generate title from tags
async function generateTitle(selectedTags) {
    const prompt = `Generate a short, catchy, creative video game title for a game with these tags: ${selectedTags.join(', ')}. Return ONLY the title, no quotes.`;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Title generation failed:", error);
        return `Untitled ${selectedTags[0]} Game`;
    }
}

// Helper to generate fake tips
async function generateTips(title, tags) {
    const prompt = `Generate 3 funny, fake "loading screen tips" for a video game titled "${title}" with tags: ${tags}. 
    They should sound like real game advice but be slightly absurd or specific to the genre. 
    Return them as a JSON array of strings. Example: ["Don't forget to reload your sword.", "Press Jump to jump."].`;
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Clean up markdown if present
        const jsonStr = text.replace(/```json\s*/, '').replace(/```\s*/, '').replace(/```$/, '');
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Tip generation failed:", error);
        return [
            "Loading pixels...",
            "Generating fun...",
            "Reticulating splines..."
        ];
    }
}

// Helper to read games
function getGames() {
    if (!fs.existsSync(GAMES_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

// Helper to save game
function saveGame(gameData) {
    const games = getGames();
    games.unshift(gameData); // Add to top
    fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2));
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Routes
app.get('/', async (req, res) => {
    const games = getGames();
    
    // Generate 5 suggestions
    const suggestions = [];
    for (let i = 0; i < 5; i++) {
        const selectedTags = getRandomTags(3);
        // We can run these in parallel for speed, but let's keep it simple first or use Promise.all
        suggestions.push({ tags: selectedTags });
    }

    // Fetch titles in parallel
    await Promise.all(suggestions.map(async (s) => {
        s.title = await generateTitle(s.tags);
    }));

    res.render('index', { 
        title: 'SLOPGAMES - Procedural Game Generator',
        suggestions: suggestions,
        games: games
    });
});

app.get('/search', (req, res) => {
    const query = req.query.q;
    // For now, search just redirects to generating a game with that query as a prompt
    // or we could show a "Search Results" page that lets you generate a game from the query.
    res.render('search', { query });
});

app.get('/category/:name', (req, res) => {
    const category = req.params.name;
    res.render('category', { category });
});

app.get('/play/:id', (req, res) => {
    const games = getGames();
    const game = games.find(g => g.id === req.params.id);
    
    if (!game) {
        return res.status(404).render('error', { message: 'Game not found.' });
    }
    
    const gamePath = path.join(__dirname, 'public', 'games', `${game.id}.html`);
    let gameCode = '';
    try {
        gameCode = fs.readFileSync(gamePath, 'utf8');
    } catch (e) {
        gameCode = '<h1>Error loading game file.</h1>';
    }

    res.render('play', { gameCode, prompt: game.prompt, game });
});

app.post('/generate', async (req, res) => {
    const { prompt, type, title, tags } = req.body;
    
    // Generate tips quickly
    const tips = await generateTips(title || 'Game', tags || type || 'Arcade');
    
    res.render('loading', {
        title: title || 'New Game',
        tags: tags || type || '',
        prompt: prompt,
        type: type,
        tips: tips
    });
});

app.post('/api/create-game', async (req, res) => {
    const { prompt, type, title, tags } = req.body;
    try {
        // 1. Generate Game Code
        let finalPrompt = prompt;
        if (title && tags) {
            finalPrompt = `Create a browser game titled "${title}". It should combine elements of these genres: ${tags}. Gameplay description: ${prompt}`;
        }

        const gameCode = await gameGenerator.generateGame(finalPrompt, type);
        
        // 2. Create ID and Paths
        const id = Date.now().toString();
        const gameFilename = `${id}.html`;
        const thumbFilename = `${id}.png`;
        const gamePath = path.join(__dirname, 'public', 'games', gameFilename);
        const thumbPath = path.join(__dirname, 'public', 'thumbnails', thumbFilename);

        // 3. Save Game File
        fs.writeFileSync(gamePath, gameCode);

        // 4. Generate Thumbnail
        let hasThumbnail = false;
        try {
            const thumbPrompt = title ? `${title} - ${tags} style game` : prompt;
            hasThumbnail = await imageGenerator.generateThumbnail(thumbPrompt, thumbPath);
        } catch (imgErr) {
            console.error("Thumbnail generation failed:", imgErr);
        }

        // 5. Save Metadata
        const newGame = {
            id,
            prompt: finalPrompt,
            title: title || 'Untitled Game',
            tags: tags ? tags.split(',') : [type],
            type,
            date: new Date().toISOString(),
            thumbnail: hasThumbnail ? `/thumbnails/${thumbFilename}` : null
        };
        saveGame(newGame);

        // 6. Return ID
        res.json({ id });

    } catch (error) {
        console.error('Game generation failed:', error);
        res.status(500).json({ message: 'Failed to generate game.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
