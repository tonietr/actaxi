const axios = require('axios');
const CompanyData = require('../company.data')
var js2xmlparser = require("js2xmlparser");
const { Op } = require("sequelize")
const fs = require('graceful-fs');
const jwt = require('../jwt')
const TripData = require('../config/sequelize').TripData
const { PromisePool } = require('@supercharge/promise-pool')

const convertSingleTripData = async (trip) => {
    var Shift = {
        ShiftID: trip.ShiftID,
        VehRegNo: trip.VehRegNo,
        VehRegJur: trip.VehRegJur,
        DriversLicNo: trip.DriversLicNo,
        DriversLicJur: trip.DriversLicJur,
        ShiftStartDT: trip.ShiftStartDT.toISOString(),
        ShiftEndDT: trip.ShiftEndDT.toISOString()
    }
    var Trip = {
        ShiftID: trip.ShiftID,
        TripID: trip.TripID,
        TripTypeCd: trip.TripTypeCd,
        TripStatusCd: trip.TripStatusCd,
        HailTypeCd: trip.HailTypeCd,
        HailInitDT: trip.HailInitDt.toISOString(),
        HailAnswerSecs: trip.HailAnswerSecs,
        HailRqstdLat: trip.HailRqstdLat,
        HailRqstdLng: trip.HailRqstdLng,
        PreBookedYN: trip.PreBookedYN,
        SvcAnimalYN: trip.SvcAnimalYN,
        VehAssgnmtDT: trip.VehAssgnmtDt.toISOString(),
        VehAssgnmtLat: trip.VehAssgnmtLat,
        VehAssgnmtLng: trip.VehAssgnmtLng,
        PsngrCnt: trip.PsngrCnt,
        TripDurationMins: trip.TripDurationMins,
        TripDistanceKMs: trip.TripDistanceKMs,
        TtlFareAmt: trip.TtlFareAmt,
        PickupArrDT: trip.PickupArrDt.toISOString(),
        PickupDepDT: trip.PickupDepDt.toISOString(),
        PickupLat: trip.PickupLat,
        PickupLng: trip.PickupLng,
        DropoffArrDT: trip.DropoffArrDt.toISOString(),
        DropoffDepDT: trip.DropoffDepDt.toISOString(),
        DropoffLat: trip.DropoffLat,
        DropoffLng: trip.DropoffLng
    }

    return { Shift, Trip }
}

const isDate = (date) => {
    const regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])Z');
    return regExp.test(date);
}

const extractDays = async (start, end) => {
    try {
        if (isDate(start) && isDate(end)) {
            const startDate = new Date(start)
            const endDate = new Date(end)
            const daysElapsed = (endDate - startDate) / (1000 * 3600 * 24);
            if (daysElapsed < 0) {
                throw ("Dates combination not valid")
            }
            return daysElapsed
        }
        else {
            throw ("Date is not properly formatted")
        }
    } catch (err) {
        return err
    }
}

const convertToSmallerDates = async (start, end) => {
    const dateArray = []

    let initialDate = new Date(start)

    let currentDate = new Date(start)
    currentDate = new Date(currentDate.setTime(currentDate.getTime() + 1000*60*60*24))

    let temp = new Date(currentDate)

    let endDate = new Date(end)
    if (initialDate.getTime() <= endDate.getTime()) {
        dateArray.push({ from: initialDate.toISOString(), to: currentDate.toISOString() })
    }
    else if (initialDate.getTime() > endDate.getTime()) return dateArray

    while (temp < endDate) {
        const startDate = new Date(temp)
        const endDate = new Date(temp.setDate(temp.getDate() + 1))
        dateArray.push({
            from: startDate.toISOString(),
            to: endDate.toISOString()
        })
    }

    return dateArray
}


const getTripData = async (start, end) => {
    const answer =  await TripData.findAll({
        where: {
            StartDt: {
                [Op.eq]: start
            },
            EndDt: {
                [Op.lte]: end
            }
        }
    })
    return answer;
}

const processInBatch = async (start, end) => {
    const arr = await convertToSmallerDates(start, end)
    let answer = [];
    const { results, errors } = await PromisePool
        .for(arr)
        .withConcurrency(100)
        .process(async range => {
            //get trip data
            //convert them to xml
            //return the xml in an array
            const dailyTripData = await getTripData(range.from, range.to);
            for (let i = 0; i < dailyTripData.length; i++) {
                answer.push(await convertSingleTripData(dailyTripData[i]))
            }
        })
    return [answer, errors]
}

exports.getBookingWithin = async (start, end, req, res) => {

    //First pull all data from date A to date B
    //do concurrency to convert all trip to xml format
    //add the header and save the files
    const numberOfDays = await extractDays(start, end)
    if (typeof numberOfDays === 'string') res.status(401).send({ response: numberOfDays })
    else {
        try {
            //determine how many days needed to query
            //let's say n days, make n promise pool and get all data from a single day
            //convert that day into xml format, specifically store it in shift data array, trip data array
            //add the header and save the files
            var Header = {
                //UserID and ApplicationID mostly used for WebService API.
                UserID: 'nirvana',
                ApplicationID: '0908099',
                PTNo: CompanyData.PTNo,
                NSCNo: CompanyData.NSCNo,
                SvcTypCd: CompanyData.SvcTypCd,
                StartDt: start,
                EndDt: end
            };
            var Shift = []
            var Trip = []


            const [results, errors] = await processInBatch(start, end)
            
            if (results.length == 0) {
                res.status(200).send("No data is found within the specified date")
            }
            else {
                results.forEach(trip => {
                    Shift.push(trip.Shift)
                    Trip.push(trip.Trip)
                })
    
                var ShiftData = {
                    Shift
                }
    
                var TripData = {
                    Trip
                }
                var submission = {
                    "@": {
                        'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
                        'xsi:noNamespaceSchemaLocation': "PassengerTrip.xsd"
                    },
                    Header,
                    ShiftData,
                    TripData
                }
                var r = await js2xmlparser.parse("PassengerTrip", submission)
                fs.writeFile('xml/auto_generated.xml', r, function (err) {
                    if (err) throw new Error('Fail to write files')
                    else {
                        console.log('done')
                        res.status(200).download('xml/auto_generated.xml', 'auto_generated.xml', function(err){
                            if (err) console.log(err)
                        })
                    }
                })
            }
            
        }
        catch (err) {
            res.status(500).send({
                response: err
            })
        }
    }

    //WIP wait for the JWT Token from PTB
    // const {shift, trip} = await convertSingleTripData()
    // var ShiftData = {...ShiftData, shift}
    // ShiftData.push(shift)
    // var TripData = {...TripData, trip}
    // var submission = {
    //     "@": {
    //         'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
    //         'xsi:noNamespaceSchemaLocation': "PassengerTrip.xsd"
    //     },
    //     Header,
    //     ShiftData,
    //     TripData
    // }
    // var result = js2xmlparser.parse("PassengerTrip", submission)
    // // const token = await jwt.generateJWToken()
    // // console.log();
    // fs.writeFile('xml_trip.xml', result, function (err) {
    //     if (err) throw new Error('Fail to write files')
    // })
    // res.send("Completed")
}