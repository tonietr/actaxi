
import "bootstrap/dist/css/bootstrap.min.css";
import React, {useState} from 'react';
import {DayPicker} from "react-day-picker";
import 'react-day-picker/dist/style.css';
import download from 'downloadjs';

function App() {
  const [selectedStartDt, setSelectedStartDt] = useState(new Date("2022-04-20T00:00:00.000Z"));
  const [selectedEndDt, setSelectedEndDt] = useState(new Date("2022-04-21T00:00:00.000Z"));

  var date = new Date();
  const maxDate = date.setDate(date.getDate() - 8);

  const disabledDays = [
    { to: selectedStartDt }
  ];

  let startfooter = <p>Please pick a day.</p>;
  let endfooter = <p>Please pick a day.</p>;
  
  const requestXMLFiles = async () => {
    const start = selectedStartDt.toISOString().split('T')[0] + 'Z'
    const end = selectedEndDt.toISOString().split('T')[0] + 'Z'
    var url = 'http://localhost:8081/convertToXML?' + 'from=' + start + '&to=' + end
    const response = await fetch(url);
    const blob = await response.blob();
    download(blob, 'auto_generated.xml')
    console.log("Successful")
  }

  return (
    <>
      <h3 style={{paddingTop: '50px', textAlign: 'center'}}>Request Data Trip XML</h3>
      <div style={{paddingTop: '50px' ,display: 'flex', flexDirection: "row", gap: '50px', justifyContent: 'center', alignItems: 'center',textAlign: 'center'}}>
        <div>
        <h4>Select Start Date</h4> 
        <DayPicker mode="single"
          defaultMonth = {selectedStartDt}
          selected={selectedStartDt}
          onSelect={setSelectedStartDt}
          autoFocus={true}
          disabled={disabledDays}
          />
        </div>
        <div>
        <h4>Select End Date</h4>
        <DayPicker mode="range"
          defaultMonth = {selectedEndDt}
          selected={selectedEndDt}
          autoFocus={true}
          closeCalendar={true}
          minDate = {new Date()}
          maxDate= {maxDate}
          onSelect={setSelectedEndDt}
          />
        </div>
      </div>
      <div style={{paddingTop: '30px', display: 'flex', justifyContent: 'center'}}>
          <button onClick = {requestXMLFiles}>Request XML file</button>
      </div>
    </>
  );
}

export default App;
