const axios = require('axios');
const ApiToken = require('../api.token')
const getDriverShift = async (start, end) => {
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

exports.getShiftWithin = async(start, end, req, res) => {
    const response = await getDriverShift(start, end)
    if (response.data) {
        res.status(200).json({
            message: "Called Successful",
            bookings: response.data
        })
    }
    else {
        res.status(401).json({
            message: "Error"
        })
    }
}