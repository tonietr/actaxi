const cron = require('node-cron')
const COMPANY_DATA = require('./company.data')

module.exports.cronSchedule = cron.schedule('* * * * * *', function(){
    console.log("Pulling data from the start date until 7 days from now...")
    console.log("The past end date is: ", COMPANY_DATA.endDate)
    
    var date = new Date();
    date.setDate(date.getDate() - 8);
    console.log("The current end date is : " , date.toISOString())

    if (new Date(COMPANY_DATA.endDate) < date) {
        console.log("Date past")
    }
    console.log('Requesting daily data from ')
})