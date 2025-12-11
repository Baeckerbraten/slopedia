require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const gameGenerator = require('./src/gameGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'SLOPGAMES - Procedural Game Generator',
        categories: ['Arcade', 'Puzzle', 'Text Adventure', 'Simulation', 'Card Game']
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

app.post('/generate', async (req, res) => {
    const { prompt, type } = req.body;
    try {
        const gameCode = await gameGenerator.generateGame(prompt, type);
        res.render('play', { gameCode, prompt });
    } catch (error) {
        console.error('Game generation failed:', error);
        res.status(500).render('error', { message: 'Failed to generate game. Please try again.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
