const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const res = require('express/lib/response');
const app = express();
const port = 9098;
const fs = require('graceful-fs');
const ShiftController = require('./controller/shift.controller')
const BookingHistoryController = require('./controller/booking.history.controller')
const ConvertController = require('./controller/convert.controller')
const { PromisePool } = require('@supercharge/promise-pool')
const {sequelize} = require('./config/sequelize')

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

const foo = async (numbers) => {
    const { results, errors } = await PromisePool
    .for(numbers)
    .withConcurrency(1)
    .process(async n => {
        let r = n * 2;
        r = r.toString();
        fs.appendFileSync('abc.txt', r, function (err) {
            if (err) throw new Error(err)
        });
    })
    return [results, errors]
}

app.get('/printSomething', async(req, res) =>  {
    // let numbers = [];
    // for (let i = 0; i < 1000000; i++) {
    //     numbers.push(Math.random())
    // }

    let numbers2 = [];
    for (let i = 0; i < 10000000; i++) {
        numbers2.push(Math.random())
    }

    const [ress, err] = await foo(numbers2)
    const [ress2, err2] = await foo(numbers2)


    console.log("result2", ress)
    console.log("errors2", err)
    console.log("result", ress2)
    console.log("errors", err2)
    res.send("Print something ne`" + ress)
})

app.listen(port, async () => {
    console.log(`Listening on port ${port}!`)
    try {
        await sequelize.authenticate();
        await sequelize.sync({alter: true})
        console.log("Connected to database")
    }
    catch (error) {
        console.error('Unable to connect to database')
        console.log(error)
    }
});