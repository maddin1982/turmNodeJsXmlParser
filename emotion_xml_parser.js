var parseString = require('xml2js').parseString;
var http = require('http')
var xml = '';

var date=new Date()
requestXmlFile(date)


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
function requestXmlFile(date){
	console.log("request xml for date "+ formatDateString(date))
	/* MAKE REQUEST TO SERVER */
	var req = http.get(getUrlOfXMLFileByDate(date), function(res) {
	
		if (res.statusCode === 404 || res.statusCode === 403) {
			console.log("no xml file for date "+ formatDateString(date))
			requestXmlFile(new Date(date.setDate(date.getDate()-1)))
			return;
		}
	
		res.on('data', function(chunk) {
			xml += chunk;
		});
		res.on('end', function() {
		  parseString(xml, function (err, result) {
			createAnimation(result);
		  });
		});
	});

	/* ON ERROR TRY TO GET XML OF DAY BEFORE */
	req.on('error', function(err) {
		console.log("no xml file for date "+ formatDateString(date))
	  // try day before
	  
	  requestXmlFile(date.setDate(date.getDate()-1))
	});
}

function createAnimation(emotionalData){
	console.log(JSON.stringify(emotionalData));
}

/* CREATE FRAMES FROM EMOTION VALUES */

/* SEND FRAMES TO TOWER OVER UDP */
