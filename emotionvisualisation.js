var PORT = 33333;
var HOST = '127.0.0.1';
//var HOST = '37.187.39.90';

var parseString = require('xml2js').parseString;
var http = require('http')
var xml = '';

var currentDate=new Date()
requestXmlFile(currentDate)
var JSONData={};

var express = require('express.io');
var app = express();

//open socket
app.http().io();
app.use(express.static(__dirname + '/visualisation'));

var server = app.listen(3033, function() {
	var host = server.address().address;
	var port = server.address().port;
	console.log('tower app listening at http://%s:%s', host, port);
});

//incomming call
app.io.route('ready', function(req) {
	//check current date
	var date = new Date();
	
	if (currentDate!=date) {
		//if new date , request new data
		requestXmlFile(date, function(result){
			req.io.emit('emotionData', {
				message:result
			})	
		});
		currentDate=date;
	}
	else {
		req.io.emit('emotionData', {
		message:JSONData
		})			
	}
})

function formatDateString(date){
	var year=date.getFullYear();
	var month=date.getMonth()+1;
	if(month<10)month="0"+month;
	var day= date.getDate()
	if(day<10)var day="0"+day;
	return year+"-"+month+"-"+day;
}

/* RETURN URL OF TODAYS XML FILE */
function getUrlOfXMLFileByDate(date){
	/* get values of yesterday if date is before 20:00, values of today are not uploaded before 20:00*/
	if(date.getHours()<20){date.setDate(date.getDate()-1);}
	var filename= formatDateString(date)
	return 'http://wwwpub.zih.tu-dresden.de/~hauthal/DNN-Tweets-Emotions/XmlFiles/'+filename+'.xml';
}
function requestXmlFile(date, callback, retryCounter){
	/* MAKE REQUEST TO SERVER */
	
	var retryCounter = retryCounter || 0;
	
	var req = http.get(getUrlOfXMLFileByDate(date), function(res) {
	
		if (res.statusCode === 404 || res.statusCode === 403) {
			console.log("no xml file for date "+ formatDateString(date))
			retryCounter++;
			if(retryCounter>10)
				process.exit();
			requestXmlFile(new Date(date.setDate(date.getDate()-1)), callback, retryCounter)
			return;
		}
	
		res.on('data', function(chunk) {
			xml += chunk;
		});
		res.on('end', function() {
		 console.log("message complete")
		  parseString(xml, function (err, result) {
			JSONData = removeDoubleValues(result);
			app.io.broadcast('emotionData', {
				message:JSONData
			})
		  });
		});
	});

	/* ON ERROR TRY TO GET XML OF DAY BEFORE */
	req.on('error', function(err) {
		retryCounter++;
		if(retryCounter>10)
			process.exit();
		console.log("no xml file for date "+ formatDateString(date))
		// try day before
		requestXmlFile(date.setDate(date.getDate()-1), callback, retryCounter)
	});
}



/**********************************
* Helpers
************************************/

var removeDoubleValues = function(dataJson){
	var newArray = [];
	var nameArray = [];
	
	var singleEmotions = dataJson.DnnEmotions.SingleEmotions[0].Emotion;
	for (var i = 0; i <singleEmotions.length; i++){
		if(nameArray.indexOf(singleEmotions[i].Word[0]) == -1){
			newArray.push(singleEmotions[i])
		}
		nameArray.push(singleEmotions[i].Word[0]);
	}
	dataJson.DnnEmotions.SingleEmotions[0].Emotion = newArray;
	console.log(dataJson.DnnEmotions.SingleEmotions[0].Emotion);
	return dataJson;
}

var percentColors = [
	{ pct: 0.0, color: { r: 0xFC, g: 0x2E, b: 0x1B } },
	//{ pct: 0.5, color: { r: 0xB7, g: 0xF0, b: 0xFF } },
	{ pct: 0.5, color: { r: 0xFF, g: 0xFC, b: 0xA5 } },
	{ pct: 1.0, color: { r: 0x81, g: 0xEA, b: 0 } } ];

var getColorForPercentage = function(pct) {
    for (var i = 1; i < percentColors.length - 1; i++) {
        if (pct < percentColors[i].pct) {
            break;
        }
    }
    var lower = percentColors[i - 1];
    var upper = percentColors[i];
    var range = upper.pct - lower.pct;
    var rangePct = (pct - lower.pct) / range;
    var pctLower = 1 - rangePct;
    var pctUpper = rangePct;
    var color = {
        r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
        g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
        b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
    };
    return [color.r, color.g, color.b];
}  


