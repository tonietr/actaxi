const axios = require('axios');
const ApiToken = require('../api.token')
const fs = require('graceful-fs');
const CompanyData = require('../company.data')
const { PromisePool } = require('@supercharge/promise-pool');
const res = require('express/lib/response');
const TripData = require('../config/sequelize').TripData
const perf = require('execution-time')();
const MESSAGE = require('../message')
var Bottleneck = require("bottleneck/es5");
const limiter = new Bottleneck({
    maxConcurrent: 10,
    minTime: 1000
  });

const getBookingHistory = async (start, end, limit, offset) => {
    try {
        return await axios.get('https://api.icabbicanada.com/ca2/bookings/history', {
            headers: {
                'Content-Type': 'application/json'
            },
            auth: {
                username: ApiToken.username,
                password: ApiToken.password
            },
            params: {
                order: 'closed_date',
                from: start,
                to: end,
                limit: limit,
                Order: 'id',
                direction: 'DESC',
                status: 'COMPLETED',
                offset: offset
            }
        })
    } catch (error) {
        console.log("Error making API Calls " ,error)
    }
}

const formatTripStatusCd = (TripStatusCd) => {
    // console.log("TRIP: ", TripStatusCd)
    if (TripStatusCd === "COMPLETED") return "CMPLT"
    else if (TripStatusCd === "NOSHOW") return "NOSHO"
    else return TripStatusCd
}

const formatHailTypeCd = (HailTypeCd) => {
    if (HailTypeCd === "DISPATCH") return "PHONE"
    return HailTypeCd
}

const isStreetHail = (OperatorID, UserID, Name, Phone, AccountID) => {
    if (OperatorID === '0' && UserID === '0' && Name === "" && Phone === "" && AccountID === 0) return true
}

const getTimeElapsedInSecs = (start, end) => {
    const diffInSecs = Math.abs(new Date(end) - new Date(start)) / 1000;
    if (diffInSecs >= 100000) return 99999
    return diffInSecs
}

const getAllDriversHoursWorked = async (start, end) => {
    try {
        return await axios.get('https://api.icabbicanada.com/ca2/drivers/hours', {
            headers: {
                'Content-Type': 'application/json'
            },
            auth: {
                username: ApiToken.username,
                password: ApiToken.password
            },
            params: {
                from: start,
                to: end
            }
        })
    } catch (error) {
        console.log("Error making API Calls " ,error)
    }
}

const extractShiftInfoByDriverId = (driverId, bookedDate, closeDate, processedHoursWorkedResponse) => {
    //use pickup since some closed_date extended way beyond driver's shift
    //legit if 'from' <= 'booked_date' && if 'to' >= 'close_date'
    const bookedDateInSecs = new Date(bookedDate).getTime() / 1000;
    const closeDateInSecs = new Date(closeDate).getTime() / 1000;
    // console.log(bookedDateInSecs)
    // console.log(closedDateInSecs)
    // console.log('driverId', driverId.toString())
    driverId = driverId.toString()
    // console.log(driverId)
    // console.log("BOOKEDDATE", bookedDateInSecs)
    // console.log("closeDateInSecs", closeDateInSecs)
    const driverShift = processedHoursWorkedResponse.find(shift =>
        shift.driver_id === driverId && shift.from <= bookedDateInSecs && shift.to >= closeDateInSecs)
    // console.log(driverShift)
    let driverShiftFrom = "N/A";
    let driverShiftTo = "N/A";
    if (driverShift) {
        driverShiftFrom = new Date(driverShift.from * 1000)
        driverShiftTo = new Date(driverShift.to * 1000)
        return [driverShiftFrom, driverShiftTo, driverShift.from.toString(), driverShift.to.toString()]
    }

    //this should not happen unless closed date is beyond driver shift ended
    else return [driverShiftFrom, driverShiftTo, "NA", "NA"]
    //else not legit, will return {null, null}
}

const processBookingResponse = async (start, end, response, processedHoursWorkedResponse) => {
    let result = [...response.map(({
        operator_id: OperatorID,
        user_id: UserID,
        name: Name,
        phone: Phone,
        account_id: AccountID,
        PTNo = CompanyData.PTNo,
        NSCNo = CompanyData.NSCNo,
        SvcTypCd = CompanyData.SvcTypCd,
        StartDt = null,
        EndDt = null,
        ShiftID = null,
        vehicle: { reg: VehRegNo },
        VehRegJur = CompanyData.VehRegJur,
        driver: { licence: DriversLicNo, id: DriverId },
        DriversLicJur = CompanyData.DriversLicJur,
        ShiftStartDT = null,
        ShiftEndDT = null,
        trip_id: TripID,
        TripTypeCd = CompanyData.TripTypeCd,
        status: TripStatusCd,
        HailAnswerSecs = 0,
        source: HailTypeCd,
        created_date: HailInitDt,
        address: { lat: HailRqstdLat, lng: HailRqstdLng },
        prebooked: PreBooked,
        SvcAnimalYN = "N",
        booked_date: VehAssgnmtDt,
        //set it as default AC Taxi 
        //addr: 835 Old Victoria Rd, Nanaimo, BC V9R 5Z9
        VehAssgnmtLat,
        VehAssgnmtLng,
        payment: { passengers: PsngrCnt },
        TripDurationMins,
        payment: { distance_charged: TripDistanceKMs },
        payment: { total: TtlFareAmt },
        arrive_date: PickupArrDt,
        contact_date: PickupDepDt,
        address: { actual_lat: PickupLat },
        address: { actual_lng: PickupLng },
        close_date: DropoffArrDt,
        close_date: DropoffDepDt,
        destination: { actual_lat: DropoffLat },
        destination: { actual_lng: DropoffLng },
    }) => {
        // StartDt = StartDt.split('T')[0] + 'Z'
        // EndDt = EndDt.split('T')[0] + 'Z'
        TripStatusCd = formatTripStatusCd(TripStatusCd)
        HailTypeCd = formatHailTypeCd(HailTypeCd)
        HailAnswerSecs = getTimeElapsedInSecs(VehAssgnmtDt, HailInitDt)
        const [ShiftStartDate, ShiftEndDate, ShiftStartDateInSecs, ShiftEndDateInSecs] = extractShiftInfoByDriverId(DriverId, VehAssgnmtDt, DropoffArrDt, processedHoursWorkedResponse)

        if (ShiftStartDate !== "N/A" && ShiftEndDate !== "N/A") {
            ShiftStartDT = ShiftStartDate.toISOString()
            ShiftEndDT = ShiftEndDate.toISOString()
            StartDt = ShiftStartDT.split('T')[0] + 'Z'
            EndDt = ShiftEndDT.split('T')[0] + 'Z'
        }
        else {
            ShiftStartDT = ShiftStartDate
            ShiftEndDT = ShiftEndDate
            StartDt = ShiftStartDT
            EndDt = ShiftEndDT
        }

    
        ShiftID = DriverId + ShiftStartDateInSecs + ShiftEndDateInSecs + TripID
        PreBookedYN = PreBooked ? "Y" : "N"
        TripDurationMins = parseInt(getTimeElapsedInSecs(VehAssgnmtDt, DropoffArrDt) / 60);
        TripDistanceKMs = parseFloat(Number(TripDistanceKMs).toFixed(1));
        //Re-format the date 
        HailInitDt = new Date(HailInitDt).toISOString()
        VehAssgnmtDt = new Date(VehAssgnmtDt).toISOString()
        PickupArrDt = new Date(PickupArrDt).toISOString()
        PickupDepDt = new Date(PickupDepDt).toISOString()
        DropoffArrDt = new Date(DropoffArrDt).toISOString()
        DropoffDepDt = new Date(DropoffDepDt).toISOString()

        if (isStreetHail(OperatorID, UserID, Name, Phone, AccountID)) {
            // console.log("FOUND STREET HAIL")
            HailTypeCd = "FLAG"
            VehAssgnmtLat = HailRqstdLat
            VehAssgnmtLng = HailRqstdLng
            PickupArrDt = HailInitDt
        }
        return {
            PTNo,
            NSCNo,
            SvcTypCd,
            StartDt,
            EndDt,
            ShiftID,
            VehRegNo,
            VehRegJur,
            DriversLicNo,
            DriversLicJur,
            ShiftStartDT,
            ShiftEndDT,
            TripID,
            TripTypeCd,
            TripStatusCd,
            HailTypeCd,
            HailInitDt,
            HailAnswerSecs,
            HailRqstdLat,
            HailRqstdLng,
            PreBookedYN,
            SvcAnimalYN,
            VehAssgnmtDt,
            VehAssgnmtLat,
            VehAssgnmtLng,
            PsngrCnt,
            TripDurationMins,
            TripDistanceKMs,
            TtlFareAmt,
            PickupArrDt,
            PickupDepDt,
            PickupLat,
            PickupLng,
            DropoffArrDt,
            DropoffDepDt,
            DropoffLat,
            DropoffLng,
        }
    })]

    return result
}
const combineAllDriverShifts = async (hoursWorkedResponse) => {
    let result = []
    // console.log("HOURS ", hoursWorkedResponse)
    hoursWorkedResponse.data.body.hours.forEach(shift => {
        let matched = result.find(element => element.driver_id === shift.driver_id && element.to === shift.from)
        if (matched) matched.to = shift.to
        else result.push({ driver_id: shift.driver_id, from: shift.from, to: shift.to })
    })
    return result
}

const updateOrCreate = async(model, where, item) => {
    const found = await model.findOne({where})
    if (!found) {
        const newItem = await model.create(item)
        return {created: true}
    }

    const updateItem = await model.update(item, {where})
    return {created: false}
}

const processTripDataWithin = async (start, end, hoursWorkedResponse, limit, offset) => {
    
    //Get all booking within a time frame
    //Format the booking data according to PTB format
    //Get all driver hours worked within the same day
    //While looping through the booking data, use driver id and search in hours worked response to find his hours
    //combine all of his hours by sum (all(from) + all(to))
    //return as shift start date, and shift end date
    const bookingResponse = await getBookingHistory(start, end, limit, offset)
    // console.log(bookingResponse)
    // console.log("Total Available", total_available)
    const processedHoursWorkedResponse = await combineAllDriverShifts(hoursWorkedResponse)
    // console.log(bookingResponse.data.body)
    if (bookingResponse.data.body.bookings && hoursWorkedResponse.data.body.hours) {
        //if current_total <= total_available
        //create n request where n = Math.floor(total_available / limit)
        const processedData = await processBookingResponse(start, end, bookingResponse.data.body.bookings, processedHoursWorkedResponse)
        if (processedData) {
            //filter out NA fields
            // console.log('processed data size: ', processedData.length)
            const filteredData = await processedData.filter(data =>
                data.VehRegNo.length >= 5 
                &&
                data.DriversLicNo >= 5 
                &&
                data.ShiftStartDT !== "N/A" &&
                data.ShiftEndDT !== "N/A" &&
                new Date(end) >= new Date(data.VehAssgnmtDt) &&
                new Date(start) <= new Date(data.VehAssgnmtDt)
            )
            filteredData.forEach(trip => {
                updateOrCreate(TripData, {TripID: trip.TripID}, trip).then()
                .catch((err) => {
                    return MESSAGE.FAILED
                })})

            // console.log("filter data length for date from: ", start, "to: ", end, "is: ", filteredData.length)
            return MESSAGE.SUCCESSFUL
        }
        else {
            return "F"
        }
    }
    else {
        return "FA"
    }
}

const processFirstTripDataWithin = async (start, end, limit, offset) => {
    const bookingResponse = await getBookingHistory(start, end, limit, offset)
    if (bookingResponse.data.body.total_available) {
        const total_available = bookingResponse.data.body.total_available
        return [MESSAGE.SUCCESSFUL, total_available]
    }
    else {
        return [MESSAGE.FAILED, 0]
    }
}

const setTimeOutAndReturnValue = async(start, end, hoursWorkedResponse, limit, offset) => {
    // let result;
    // let promise = new Promise(function(resolve, reject) {
    //     setTimeout(async() => {
    //         // console.log("Time out for ", offset.timeOut)
    //         result = await processTripDataWithin(start, end, hoursWorkedResponse, limit, offset.offset);
    //         resolve(result)
    //       }, offset.timeOut
    //     )
    // })

    return await processTripDataWithin(start, end, hoursWorkedResponse, limit, offset.offset)
    // return promise
}

//Process 1 batch/group of data. In here we process 100 data trips
const processingSetOfTripData = async (start, end, total_available,limit) => {
    // let endAddOneHourDateObject = new Date(end)
    // //Add 12 hours ahead for the end time so it can combine accurate shift schedule 
    // //since some shifts might ended later than the specified end date
    // //if we don't expand the end date time we cannot find the corresponding shift schedule for a driver
    // endAddOneHourDateObject.setHours(endAddOneHourDateObject.getHours() + 12);
    // let endDate = endAddOneHourDateObject.toISOString();
    
    let endAddOneHourDateObject = new Date(end)
    //Add 12 hours ahead for the end time so it can combine accurate shift schedule 
    //since some shifts might ended later than the specified end date
    //if we don't expand the end date time we cannot find the corresponding shift schedule for a driver
    endAddOneHourDateObject.setHours(endAddOneHourDateObject.getHours() + 12);
    let endDate = endAddOneHourDateObject.toISOString();
    const hoursWorkedResponse = await getAllDriversHoursWorked(start, endDate)
    // //Get all driver shifts info and combine them together 
    // const hoursWorkedResponse = await getAllDriversHoursWorked(start, endDate)
    //This function process 100 trips of data or defined based on limit variable
    //It will use Promise Pool to do concurrency processing on 100 trip of data
    let offsetArray = [];
    // let currentTimeOut = 100;
    for (let i = 0; i < total_available; i = i + limit) {
        offsetArray.push({
            offset: i,
            // timeOut: currentTimeOut
        });
        // currentTimeOut += 100
    }
    // console.log(offsetArray)
    // console.log("Offset array for : ", start, ", to: ", end, " total available: ")
    const {results, errors} = await PromisePool
        .for(offsetArray)
        .withConcurrency(9)
        .process(async offset => {
            //for debugging
            // return await processTripDataWithin(start, end, hoursWorkedResponse, limit, offset);

            //for production, only check if there is errors
            return await setTimeOutAndReturnValue(start, end, hoursWorkedResponse, limit, offset)
            // await processTripDataWithin(start, end, hoursWorkedResponse, limit, offset.offset);
        })
    return [results, errors]
    // const results = await limiter.schedule(() => {
    //     const answer = offsetArray.forEach(async offset => {
    //         await processTripDataWithin(start, end, hoursWorkedResponse, limit, offset.offset)
    //     })
    //     console.log('asnwer', answer)
    //     return answer;
    // });
    // console.log("results: ", results)
    // return results
}

//Daily retrieval trip data
// exports.getBookingHistoryWithin = async (start, end, res) => {
    
//     //Initial call request with limit 1 to see how many available bookings 
//     perf.start();
//     const [initial_result, total_available] = await processFirstTripDataWithin(start, end, 1, 0)
//     console.log("Initial call with limit = 1 elapsed in ms: " , perf.stop().time)

//     if (initial_result == MESSAGE.SUCCESSFUL) {
//         if (total_available <= 0) {
//             res.status(MESSAGE.NO_DATA_PROCESSED_RESPONSE.httpCode).json({
//                 message: MESSAGE.NO_DATA_PROCESSED_RESPONSE.message
//             })
//         }
//         else {
//             //Do batch processing
//             await processingSetOfTripData(start, end, total_available, 100)
//             res.status(MESSAGE.CONVERTED_SUCCESSFULLY_RESPONSE.httpCode).json({
//                 message: MESSAGE.CONVERTED_SUCCESSFULLY_RESPONSE.message
//             })
//         }

//     }
//     else {
//         res.status(MESSAGE.CONVERTED_FAILED_RESPONSE.httpCode).json({
//             message: MESSAGE.CONVERTED_FAILED_RESPONSE.message
//         })
//     }
// }

const isDate = (date) => {
    const regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])Z)');
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

    while (temp <= endDate) {
        const startDate = new Date(temp)
        const endDate = new Date(temp.setDate(temp.getDate() + 1))
        dateArray.push({
            from: startDate.toISOString(),
            to: endDate.toISOString()
        })
    }

    return dateArray
}

const processDailyBatch = async (start, end) => {
    // let endAddOneHourDateObject = new Date(end)
    // //Add 12 hours ahead for the end time so it can combine accurate shift schedule 
    // //since some shifts might ended later than the specified end date
    // //if we don't expand the end date time we cannot find the corresponding shift schedule for a driver
    // endAddOneHourDateObject.setHours(endAddOneHourDateObject.getHours() + 12);
    // let endDate = endAddOneHourDateObject.toISOString();
    
    //Get all driver shifts info and combine them together 
    
    //Initial call request with limit 1 to see how many available bookings 
    perf.start();
    const [initial_result, total_available] = await processFirstTripDataWithin(start, end, 1, 0)
    console.log("Initial call with limit = 1 elapsed in ms: " , perf.stop().time, " Total Available: ", total_available)
    if (initial_result == MESSAGE.SUCCESSFUL) {
        if (total_available <= 0) {
            return false
        }
        else {
            //Do batch processing
            const results = await processingSetOfTripData(start, end, total_available,  100)
            results.forEach(result => {
                if (result !== 'SUCCESSFUL') return false
            })
            // if (errors.length > 0) return false
            console.log('re', results)
            return true
        }
    }
    return false
}

exports.ONSTART_getBookingHistoryWithin = async (start, end) => {
    // const dateRangeArray = await convertToSmallerDates(start, end);
    // if (dateRangeArray.length > 0){

    //     for (let i = 0; i < dateRangeArray.length; i++){
    //         await setTimeout(async() => {
    //             console.log('processing from: ', dateRangeArray[i].from, ' to: ', dateRangeArray[i].to)
    //             const isSuccessful = await processDailyBatch(dateRangeArray[i].from, dateRangeArray[i].to)
    //             if (isSuccessful) console.log("Successfully convert data from ", dateRangeArray[i].from, ",to: ", dateRangeArray[i].to)
    //             else console.log("The conversion failed from ", dateRangeArray[i].from, ",to: ", dateRangeArray[i].to)
    //         }, i * 10000)
    //     }
    // }
    // else {
    //     console.log("Invalid Start End Date Combination")
    // }

    
        console.log('processing from: ', start, ' to: ', end)
        const isSuccessful = await processDailyBatch(start, end)
        if (isSuccessful) console.log("Successfully convert data from ", start, ",to: ", end)
        else console.log("The conversion failed from ", start, ",to: ", end)
    
}

