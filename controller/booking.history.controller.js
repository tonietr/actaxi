const axios = require('axios');
const ApiToken = require('../api.token')
const fs = require('graceful-fs');
const CompanyData = require('../company.data')
const { PromisePool } = require('@supercharge/promise-pool');
const res = require('express/lib/response');
const TripData = require('../config/sequelize').TripData

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
        return error
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
        return error
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
        StartDt = start,
        EndDt = end,
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
        StartDt = StartDt.split('T')[0] + 'Z'
        EndDt = EndDt.split('T')[0] + 'Z'
        TripStatusCd = formatTripStatusCd(TripStatusCd)
        HailTypeCd = formatHailTypeCd(HailTypeCd)
        HailAnswerSecs = getTimeElapsedInSecs(VehAssgnmtDt, HailInitDt)
        const [ShiftStartDate, ShiftEndDate, ShiftStartDateInSecs, ShiftEndDateInSecs] = extractShiftInfoByDriverId(DriverId, VehAssgnmtDt, DropoffArrDt, processedHoursWorkedResponse)

        if (ShiftStartDate !== "N/A" && ShiftEndDate !== "N/A") {
            ShiftStartDT = ShiftStartDate.toISOString()
            ShiftEndDT = ShiftEndDate.toISOString()
        }
        else {
            ShiftStartDT = ShiftStartDate
            ShiftEndDT = ShiftEndDate
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
    hoursWorkedResponse.forEach(shift => {
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

    // console.log("I'm here", offset )
    const bookingResponse = await getBookingHistory(start, end, limit, offset)
    const total_processed = bookingResponse.data.body.total
    const total_available = bookingResponse.data.body.total_available
    // console.log("Total Available", total_available)
    const processedHoursWorkedResponse = await combineAllDriverShifts(hoursWorkedResponse.data.body.hours)

    // console.log(bookingResponse.data.body)
    if (bookingResponse.data.body.bookings && hoursWorkedResponse.data.body.hours) {
        //if current_total <= total_available
        //create n request where n = Math.floor(total_available / limit)
        const processedData = await processBookingResponse(start, end, bookingResponse.data.body.bookings, processedHoursWorkedResponse)
        console.log(processedData)
        if (processedData) {
            // fs.writeFile('submit_data_' + offset.toString() + '.json', JSON.stringify(processedData), function (err) {
            //     if (err) throw new Error ('Fail to write files')
            // })

            //filter out NA fields
            const filteredData = processedData.filter(data =>
                data.VehRegNo.length >= 5 &&
                data.DriversLicNo >= 5 &&
                data.ShiftStartDT !== "N/A" &&
                data.ShiftEndDT !== "N/A" &&
                new Date(end) >= new Date(data.VehAssgnmtDt) &&
                new Date(start) <= new Date(data.VehAssgnmtDt))

            filteredData.forEach(trip => {
                updateOrCreate(TripData, {TripID: trip.TripID}, trip).then().catch((err) => {
                    return ["FAILED", 0, total_available]
                })})
            
            return ["SUCCESSFUL", total_processed, total_available]
            
        }
    }
                
    //         filteredData.forEach(trip => {
    //             //Write trip data to database
    //             TripData.findOrCreate({
    //                 where: {
    //                     TripID: trip.TripID
    //                 },
    //                 defaults: {
    //                     PTNo: trip.PTNo,
    //                     NSCNo: trip.NSCNo,
    //                     SvcTypCd: trip.SvcTypCd,
    //                     StartDt: trip.StartDt,
    //                     EndDt: trip.EndDt,
    //                     ShiftID: trip.ShiftID,
    //                     VehRegNo: trip.VehRegNo,
    //                     VehRegJur: trip.VehRegJur,
    //                     DriversLicNo: trip.DriversLicNo,
    //                     DriversLicJur: trip.DriversLicJur,
    //                     ShiftStartDT: trip.ShiftStartDt,
    //                     ShiftEndDT: trip.ShiftEndDt,
    //                     TripID: trip.TripID,
    //                     TripTypeCd: trip.TripTypeCd,
    //                     TripStatusCd: trip.TripStatusCd,
    //                     HailTypeCd: trip.HailTypeCd,
    //                     HailInitDt: trip.HailInitDt,
    //                     HailAnswerSecs: trip.HailAnswerSecs,
    //                     HailRqstdLat: trip.HailRqstdLat,
    //                     HailRqstdLng: trip.HailRqstdLng,
    //                     PreBookedYN: trip.PreBookedYN,
    //                     SvcAnimalYN: trip.SvcAnimalYN,
    //                     VehAssgnmtDt: trip.VehAssgnmtDt,
    //                     VehAssgnmtLat: trip.VehAssgnmtLat,
    //                     VehAssgnmtLng: trip.VehAssgnmtLng,
    //                     PsngrCnt: trip.PsngrCnt,
    //                     TripDurationMins: trip.TripDurationMins,
    //                     TripDistanceKMs: trip.TripDistanceKMs,
    //                     TtlFareAmt: trip.TtlFareAmt,
    //                     PickupArrDt: trip.PickupArrDt,
    //                     PickupDepDt: trip.PickupDepDt,
    //                     PickupLat: trip.PickupLat,
    //                     PickupLng: trip.PickupLng,
    //                     DropoffArrDt: trip.DropoffArrDt,
    //                     DropoffDepDt: trip.DropoffDepDt,
    //                     DropoffLat: trip.DropoffLat,
    //                     DropoffLng: trip.DropoffLng
    //                 }
    //             }).then(t => {
    //                 return ["SUCCESSFUL", total_processed, total_available]

    //             }).catch((error => {
    //                 console.log(error)
    //                 return ["FAILED write to database", 0, total_available]
    //             }))
    //         })


    //     }
    //     else if (processedData === null) {
    //         return ["FAILED", 0, total_available]
    //     }
    // }
    // else {
    //     return ["FAILED-400", 0, 0]
    // }
}

const processFirstTripDataWithin = async (start, end, limit, offset) => {
    const bookingResponse = await getBookingHistory(start, end, limit, offset)
    if (bookingResponse.data.body.total_available) {
        const total_available = bookingResponse.data.body.total_available
        return ["SUCCESSFUL", total_available]
    }
    else {
        return ["FAILED", 0]
    }
}

//Concurrency
//First send GET request for limit 1
//Check response and get total_available number

//if total_available = 0, don't do Batch Processing

//if total_available > 0
//Batch Processing
//Create N = Math.floor(total_available / 100) Batches, each batch process 100 trips, specify limit = 100

//For each batch
//Get trip data, driver shifts info and do all the calculations, and store it in a variable
//Convert data into PTB format 
//export data into submit_data.json

//Process 1 batch/group of data. In here we process 100 data trips
const processingSetOfTripData = async (start, end, hoursWorkedResponse, total_available, limit) => {
    //This function process 100 trips of data or defined based on limit variable
    //It will use Promise Pool to do concurrency processing on 100 trip of data
    let offsetArray = [];
    for (let i = 0; i < total_available; i = i + limit) {
        offsetArray.push(i);
    }
    const { results, errors } = await PromisePool
        .for(offsetArray)
        .withConcurrency(100)
        .process(async offset => {
            await processTripDataWithin(start, end, hoursWorkedResponse, limit, offset);
        })
    return [results, errors]
}

//Daily retrieval trip data
exports.getBookingHistoryWithin = async (start, end, res) => {
    //Get all driver shifts info and combine them together 
    let endAddOneHourDateObject = new Date(end)
    endAddOneHourDateObject.setHours(endAddOneHourDateObject.getHours() + 12);
    let endDate = endAddOneHourDateObject.toISOString();
    console.log("END DATE", endDate)
    const hoursWorkedResponse = await getAllDriversHoursWorked(start, endDate)
    const total_processed = 0; //Check if total_processed === total_available
    const number_of_threads = 100;
    //Call request with limit 1
    const [initial_result, total_available] = await processFirstTripDataWithin(start, end, 1, 0)
    if (initial_result === "SUCCESSFUL") {
        //Do batch processing
        console.log("Total available", total_available)
        if (total_available <= 0) {
            res.status(200).json({
                message: "No Data to be processed"
            })
        }
        else {
            const [res1, err1] = await processingSetOfTripData(start, end, hoursWorkedResponse, total_available, 100)
            res.json({
                result: "Converted successfully",
                err: err1
            })
        }

    }
    else {
        console.log("Error")
        res.status(500).json({
            message: "System error"
        })
    }


}