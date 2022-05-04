const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const https = require('https')
const port = 8081;
const fs = require('graceful-fs');
const ShiftController = require('./controller/shift.controller')
const BookingHistoryController = require('./controller/booking.history.controller')
const ConvertController = require('./controller/convert.controller')
const {sequelize} = require('./config/sequelize')
const COMPANY_DATA = require('./company.data')
const perf = require('execution-time')();
app.use(cors());

// Configuring body parser middleware

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Welcome to ACTaxi!")
});

app.get('/getDriverShift', async (req, res) => {
    ShiftController.getShiftWithin('2022-03-22T00:00:00.000Z', '2022-03-22T00:30:00.000Z', req, res);
});

app.get('/convertToXML', async (req,res) => {
    ConvertController.getBookingWithin(req.query.from, req.query.to, req, res);
});

app.get('/getBooking', async (req, res) => {
    BookingHistoryController.getBookingHistoryWithin(req.query.from, req.query.to, res);
})

app.listen(port, async () => {
    console.log(`Listening on port ${port}!`)
    try {
        await sequelize.authenticate();
        //use alter to update database
        await sequelize.sync({alter: true})
        console.log("Connected to database")
        console.log("Pulling data from the start date until 7 days from now...")
        
        perf.start();
        await BookingHistoryController.ONSTART_getBookingHistoryWithin(COMPANY_DATA.startDate, COMPANY_DATA.endDate);
        console.log("Get Booking Data from" + "start: " + COMPANY_DATA.startDate + ", to end: " + COMPANY_DATA.endDate + ", Time Elapsed: ", perf.stop().time)

        
    }
    catch (error) {
        console.error('Unable to connect to database')
        console.log(error)
    }
});