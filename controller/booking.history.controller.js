const axios = require('axios');
const ApiToken = require('../api.token')
const fs = require('fs')
const CompanyData = require('../company.data')

const getBookingHistory = async (start, end) => {
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
                limit: 50,
                Order: 'id',
                direction: 'DESC',
                status: 'COMPLETED',
                offset: 0
            }
        })
    } catch (error) {
        return error
    }
}

const formatTripStatusCd = (TripStatusCd) => {
    console.log("TRIP: ", TripStatusCd)
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
    console.log(driverId)
    console.log("BOOKEDDATE", bookedDateInSecs)
    console.log("closeDateInSecs", closeDateInSecs)
    const driverShift = processedHoursWorkedResponse.find(shift => 
        shift.driver_id === driverId && shift.from <= bookedDateInSecs && shift.to >= closeDateInSecs)
    console.log(driverShift)
    let driverShiftFrom = null;
    let driverShiftTo = null;
    if (driverShift){
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
        vehicle: {reg: VehRegNo},
        VehRegJur = CompanyData.VehRegJur,
        driver : {licence: DriversLicNo, id: DriverId},
        DriversLicJur = CompanyData.DriversLicJur,
        ShiftStartDT = null,
        ShiftEndDT = null,
        trip_id: TripID,
        TripTypeCd = CompanyData.TripTypeCd,
        status: TripStatusCd,
        HailAnswerSecs = 0,
        source: HailTypeCd,
        created_date: HailInitDt,
        address: {lat: HailRqstdLat, lng: HailRqstdLng},
        prebooked: PreBooked,
        SvcAnimalYN = "N",
        booked_date: VehAssgnmtDt,
        //set it as default AC Taxi 
        //addr: 835 Old Victoria Rd, Nanaimo, BC V9R 5Z9
        VehAssgnmtLat = null,
        VehAssgnmtLng = null,
        payment: {passengers: PsngrCnt},
        TripDurationMins = null,
        payment: {distance_charged: TripDistanceKMs},
        payment: {total: TtlFareAmt},
        arrive_date: PickupArrDt,
        contact_date: PickupDepDt,
        address: {actual_lat: PickupLat},
        address: {actual_lng: PickupLng},
        close_date: DropoffArrDt,
        close_date: DropoffDepDt,
        destination: {actual_lat: DropoffLat},
        destination: {actual_lng: DropoffLng},  
    }) => {
        StartDt = StartDt.split('T')[0] + 'Z'
        EndDt = EndDt.split('T')[0] + 'Z'
        TripStatusCd = formatTripStatusCd(TripStatusCd) 
        HailTypeCd = formatHailTypeCd(HailTypeCd)
        HailAnswerSecs = getTimeElapsedInSecs(VehAssgnmtDt , HailInitDt)
        const [ShiftStartDate, ShiftEndDate, ShiftStartDateInSecs, ShiftEndDateInSecs] = extractShiftInfoByDriverId(DriverId, VehAssgnmtDt, DropoffArrDt, processedHoursWorkedResponse)
        ShiftStartDT = ShiftStartDate
        ShiftEndDT = ShiftEndDate
        ShiftID = DriverId + ShiftStartDateInSecs + ShiftEndDateInSecs
        PreBookedYN = PreBooked ? "Y" : "N"
        TripDurationMins = parseInt(getTimeElapsedInSecs(VehAssgnmtDt,DropoffArrDt) / 60); 
        TripDistanceKMs = parseFloat(Number(TripDistanceKMs).toFixed(1));
        //Re-format the date 
        HailInitDt = new Date(HailInitDt)
        VehAssgnmtDt = new Date(VehAssgnmtDt)
        PickupArrDt = new Date(PickupArrDt)
        PickupDepDt = new Date(PickupDepDt)
        DropoffArrDt = new Date(DropoffArrDt)
        DropoffDepDt = new Date(DropoffDepDt)

        if (isStreetHail(OperatorID, UserID, Name, Phone, AccountID)) {
            console.log("FOUND STREET HAIL")
            HailTypeCd = "FLAG"
            VehAssgnmtLat = HailRqstdLat
            VehAssgnmtLng = HailRqstdLng
            PickupArrDt = HailInitDt
        }

        if (HailAnswerSecs > 100,000) HailAnswerSecs = 99,998
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
        else result.push({driver_id: shift.driver_id, from : shift.from, to: shift.to})
    })
    return result
}
//Only return Street Hail Booking Trip
exports.getBookingHistoryWithin = async(start, end, res) => {
    //Get all booking within a day
    //Format the booking data according to PTB format
    //Get all driver hours worked within the same day
    //While looping through the booking data, use driver id and search in hours worked response to find his hours
    //combine all of his hours by sum (all(from) + all(to))
    //return as shift start date, and shift end date
    const bookingResponse = await getBookingHistory(start, end)
    const hoursWorkedResponse = await getAllDriversHoursWorked(start, end)
    const processedHoursWorkedResponse = await combineAllDriverShifts(hoursWorkedResponse.data.body.hours)
    
    fs.writeFile('driver_shifts.json', JSON.stringify(processedHoursWorkedResponse), function (err) {
        if (err) return console.log(err)
    })
    if (bookingResponse.data.body.bookings && hoursWorkedResponse.data.body.hours) {
        //if current_total <= total_available
        //create n request where n = Math.floor(total_available / limit)
        const processedData = await processBookingResponse(start, end, bookingResponse.data.body.bookings, processedHoursWorkedResponse)
        if (processedData) {
            // fs.writeFile('submit_data.json', JSON.stringify(processedData), function (err) {
            //     if (err) return console.log(err)
            // })
            res.status(200).json({
                message: "Converted successfully"
            })
        }
        else {
            res.status(200).json({
                message: "Data is empty"
            })
        }
        
    }
    else {
        res.status(401).json({
            message: "Error"
        })
    }
}