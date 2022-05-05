module.exports = (sequelize, DataTypes) => {
    const DriverShift = sequelize.define('DriverShift', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        PTNo: {
            type: DataTypes.STRING,
            defaultValue: PTNo
        },
        NSCNo: {
            type: DataTypes.STRING,
            defaultValue: NSCNo
        },
        SvcTypCd: {
            type: DataTypes.STRING,
            defaultValue: SvcTypCd
        },
        StartDt: {
            type: DataTypes.STRING
        },
        EndDt: {
            type: DataTypes.STRING
        },
        ShiftID: {
            type: DataTypes.STRING
        },
        VehRegNo: {
            type: DataTypes.STRING,
            defaultValue: "000000"
        },
        VehRegJur: {
            type: DataTypes.STRING,
            defaultValue: VehRegJur
        },
        DriversLicNo: {
            type: DataTypes.STRING,
            defaultValue: "000000"
        },
        DriversLicJur: {
            type: DataTypes.STRING,
            defaultValue: DriversLicJur
        },
        ShiftStartDT: {
            type: DataTypes.DATE
        },
        ShiftEndDT: {
            type: DataTypes.DATE
        },
        TripID: {
            type: DataTypes.STRING,
            
        },
        TripTypeCd: {
            type: DataTypes.STRING,
            defaultValue: TripTypeCd
        },
        TripStatusCd: {
            type: DataTypes.STRING
        },
        HailTypeCd: {
            type: DataTypes.STRING
        },
        HailInitDt: {
            type: DataTypes.DATE
        },
        HailAnswerSecs: {
            type: DataTypes.STRING,
            
        },
        HailRqstdLat: {
            type: DataTypes.DOUBLE,
            
        },
        HailRqstdLng: {
            type: DataTypes.DOUBLE,
            
        },
        PreBookedYN: {
            type: DataTypes.STRING,
            
        },
        SvcAnimalYN: {
            type: DataTypes.STRING
        },
        VehAssgnmtDt: {
            type: DataTypes.DATE
        },
        VehAssgnmtLat: {
            type: DataTypes.DOUBLE,
            defaultValue: DEFAULT_VEHICLE_ASSIGNMENT_LAT
        },
        VehAssgnmtLng: {
            type: DataTypes.DOUBLE,
            defaultValue: DEFAULT_VEHICLE_ASSIGNMENT_LNG
        },
        PsngrCnt: {
            type: DataTypes.INTEGER,
            
        },
        TripDurationMins: {
            type: DataTypes.INTEGER,
            
        },
        TripDistanceKMs: {
            type: DataTypes.DOUBLE,
            
        },
        TtlFareAmt: {
            type: DataTypes.DOUBLE,
            
        },
        PickupArrDt: {
            type: DataTypes.DATE,
            
        },
        PickupDepDt: {
            type: DataTypes.DATE,
            
        },
        PickupLat: {
            type: DataTypes.DOUBLE,
            
        },
        PickupLng: {
            type: DataTypes.DOUBLE,
            
        },
        DropoffArrDt: {
            type: DataTypes.DATE,
            
        },
        DropoffDepDt: {
            type: DataTypes.DATE,
            
        },
        DropoffLat: {
            type: DataTypes.DOUBLE,
            
        },
        DropoffLng: {
            type: DataTypes.DOUBLE,
            
        },
        timestamps: false
    })
    return DriverShift;
}
