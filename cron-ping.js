const cron = require('node-cron')
let COMPANY_DATA = require('./company.data')
const BookingHistoryController = require('./controller/booking.history.controller')
const { updateOrCreate } = require('./utils')
// second, minute, hour, day of month, month, day of week
module.exports.cronSchedule = cron.schedule('10 03 * * * *', async () => {
    console.log("The past end date is: ", COMPANY_DATA.endDate)
    var date = new Date();
    date.setDate(date.getDate() - 3);
    console.log("The current end date is : ", date.toISOString())
    const diffTime = date - new Date(COMPANY_DATA.endDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    console.log(diffDays)
    if (diffDays > 1) {
        console.log("CRON Scheduler: Retrieving new data from: ", COMPANY_DATA.endDate, ", to: ", date.toISOString())
        const response = await BookingHistoryController.getBookingHistoryWithin(COMPANY_DATA.endDate, date.toISOString());
        if (response) console.log("Converted successsfully, ", answer)
        else console.log("Converted Failed")
    }
    else {
        console.log("No new data to be pulled. Checking back tomorrow.")
    }
})