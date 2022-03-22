const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 9098;

// Where we will keep books
let books = [];

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send("Welcome to ACTaxi!")
});

app.listen(port, () => console.log(`Listening on port ${port}!`));