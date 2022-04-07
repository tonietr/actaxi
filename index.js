const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const res = require('express/lib/response');
const app = express();
const port = 9098;
const ShiftController = require('./controller/shift.controller')
const BookingHistoryController = require('./controller/booking.history.controller')

// Where we will keep books
let books = [];

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send("Welcome to ACTaxi!")
});

app.get('/getDriverShift', async (req, res) => {
    ShiftController.getShiftWithin('2022-03-01T00:00:00.000Z', '2022-03-01T00:30:00.000Z', req, res);
});

app.get('/getBooking', async (req, res) => {
    BookingHistoryController.getBookingHistoryWithin(req.query.from, req.query.to, res);
})


app.get('/printSomething', async(req, res) =>  {
    res.send("Print something ne`")
})

app.listen(port, () => console.log(`Listening on port ${port}!`));