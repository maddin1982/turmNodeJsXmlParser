var PORT = 33333;
var HOST = '127.0.0.1';
//var HOST = '37.187.39.90';

var dgram = require('dgram');
var client = dgram.createSocket('udp4');

var parseString = require('xml2js').parseString;
var http = require('http')
var xml = '';

var enableWebInterface=true

var date=new Date()
requestXmlFile(date)
var currentFrame=getBasicFrame();
var JSONData={};

if(enableWebInterface){
	var express = require('express.io');
	var app = express();
	//open socket
	app.http().io();
	app.use(express.static(__dirname + '/towerSimulation'));
	var server = app.listen(3002, function() {
		var host = server.address().address;
		var port = server.address().port;
		console.log('tower app listening at http://%s:%s', host, port);
	});
	app.io.route('ready', function(req) {
		req.io.emit('emotionData', {
			message:JSONData
		})
	})
}

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
function requestXmlFile(date,retryCounter){
	//console.log("request xml for date "+ formatDateString(date))
	/* MAKE REQUEST TO SERVER */
	
	var retryCounter=retryCounter || 0;
	
	var req = http.get(getUrlOfXMLFileByDate(date), function(res) {
	
		if (res.statusCode === 404 || res.statusCode === 403) {
			console.log("no xml file for date "+ formatDateString(date))
			retryCounter++;
			if(retryCounter>10)
				process.exit();
			
			requestXmlFile(new Date(date.setDate(date.getDate()-1)),retryCounter)
			return;
		}
	
		res.on('data', function(chunk) {
			xml += chunk;
		});
		res.on('end', function() {
		 console.log("message complete")
		  parseString(xml, function (err, result) {
			result = removeDoubleValues(result);
			createAnimation(result);
			JSONData = result;
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
	  requestXmlFile(date.setDate(date.getDate()-1),retryCounter)
	});
}

function setRGBForAllFrames(r,g,b,a){
	console.log(" r"+Math.floor(r*a)+" g"+Math.floor(g*a)+" b"+Math.floor(b*a)+" a"+a)
	if(!a)a=1;
	for (var i=0;i<16;i++){
		currentFrame[i]=[Math.floor(r*a),Math.floor(g*a),Math.floor(b*a)];
		
	}
}

function createAnimation(emotionalData){
 console.log("create animation")
	/* play all words with arousal als luminence and valence as color*/
	var maxValence=4;
	var maxArousal=4;
	animationTime=3000;
	
	var emotions=emotionalData.DnnEmotions.SingleEmotions[0].Emotion;
	if(emotions.length==0||!emotions){
		process.exit();
	}
	var i=0;

	function animateSingleEmotions(emotion){
		i++;
		var valence=Math.max(-1*maxValence,Math.min(maxValence,emotion.Valence[0]));
		var arousal=Math.min(maxArousal,emotion.Arousal[0]);
		valenceNormalized=(maxValence+valence)/(maxValence*2) // 0-1
		arousalNormalized=arousal/maxArousal; // 0-1
		var c=getColorForPercentage(valenceNormalized);
		//calculate frequency from arousal and create sine wave
		var currenttime=0;
		var currentArousalIterator=0;
		var brightnessMultiplicator=0.01;
		var fadeIn=true;
		var fadeOut=false;
		var interval= setInterval(function(){
			currenttime+=40;
			
			//sinus pulsing 
			brightness=((Math.sin(currentArousalIterator+=(arousalNormalized*arousalNormalized*arousalNormalized)/3))+1)/2;

			//set color for all windows with sinus brighness
			setRGBForAllFrames(c[0],c[1],c[2],(0.5+brightness/2)*brightnessMultiplicator);
			
			//console.log("brightnessMultiplicator "+brightnessMultiplicator)
			if(brightnessMultiplicator>=1){
				console.log("stop fadein")
				fadeIn=false;
			}
			else if(fadeIn==true){
				brightnessMultiplicator+=0.05;
			}

			if(currenttime>animationTime){
				brightnessMultiplicator-=0.05;
			}
			if(brightnessMultiplicator<=0){
				clearInterval(interval);
				//animate next emotion
				//console.log("next emotion "+i)
				
				if(i+1>emotions.length||i>50){
					generateHighArousalFrame(emotionalData);
				}
				else{
					animateSingleEmotions(emotions[i]);
				}
			}
			sendFrame(currentFrame);
		}, 40);
	}
	//all emotions
	animateSingleEmotions(emotions[i]);	
	
}

function generateHighArousalFrame(emotionalData){
	var frame=getBasicFrame();

	var emotionPercent=emotionalData.DnnEmotions.Percent[0]
	var p_h=parseInt(emotionPercent.PositiveValenceAndHighArousal);
	var p_l=parseInt(emotionPercent.PositiveValenceAndLowArousal);
	var n_h=parseInt(emotionPercent.NegativeValenceAndHighArousal);
	var n_l=parseInt(emotionPercent.NegativeValenceAndLowArousal);
	
	p_l+=p_h;
	n_h+=p_l;
	n_l+=n_h;

	for(var i=0;i<frame.length;i++){
		if((i/frame.length)>=0){
			frame[i]=[129,234,0]
		}
		if((i/frame.length)>(p_h/100)){
			frame[i]=[92,134,41]
		}
		if((i/frame.length)>(p_l/100)){
			frame[i]=[252,46,27]
		}
		if((i/frame.length)>=(n_h/100)){
			frame[i]=[142,59,52]
		}
	}
	console.log(frame)
	fadeToColor(frame)
}

function rotateFrames(){
	var rotateTime=20;
	var delay=300;
	var fadeoutCounter=100;
	var fadeoutCounterCurrent=fadeoutCounter
	var tickCount=0;
	var currentframeCopy=JSON.parse(JSON.stringify(currentFrame));
	
	//var interval=setInterval(function () {tick()}, 1000/fps);
	//recursive tick
	function tick() {
		if(rotateTime>5.2){
			rotateTime-=delay/1000;
			delay*=0.98;
		}
		tickCount++;
		
		for(var i=0;i<currentFrame.length;i++){
			currentFrame[i]=currentframeCopy[(i+tickCount)%16]
		}
		if(rotateTime<5.2){
			//clearInterval(interval)
			/* EOF */
			//fadeout and exit	
				
			for(var i=0;i<currentFrame.length;i++){
				currentFrame[i][0]=Math.floor(currentFrame[i][0]*(fadeoutCounterCurrent/fadeoutCounter));
				currentFrame[i][1]=Math.floor(currentFrame[i][1]*(fadeoutCounterCurrent/fadeoutCounter));
				currentFrame[i][2]=Math.floor(currentFrame[i][2]*(fadeoutCounterCurrent/fadeoutCounter));
			}
			sendFrame(currentFrame);
			//console.log(JSON.stringify(currentFrame))
			fadeoutCounterCurrent-=0.1;
			if(fadeoutCounterCurrent<0){
				process.exit();
			}
		}
		console.log("currentFrame "+JSON.stringify(currentFrame))	
		sendFrame(currentFrame);
		setTimeout(function(){tick()},delay);
	
	}
	tick();
}

function fadeToColor(frame){
	var fadelength=5;
	var fps=20;
	var tickCount=0;
	var perc=0;
	
	var interval=setInterval(function () {tick()}, 1000/fps);
	function tick() {
		tickCount++;
		perc=tickCount/(fps*fadelength);
		for(var i=0;i<currentFrame.length;i++){
			currentFrame[i][0]=Math.floor(currentFrame[i][0]*(1-perc)+frame[i][0]*perc);
			currentFrame[i][1]=Math.floor(currentFrame[i][1]*(1-perc)+frame[i][1]*perc);
			currentFrame[i][2]=Math.floor(currentFrame[i][2]*(1-perc)+frame[i][2]*perc);
		}
		sendFrame(currentFrame);
		
		if(tickCount>fps*fadelength){
			clearInterval(interval)
			rotateFrames();
		}
	}
	

}


function getBasicFrame(){
	return [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]]
}

function sendFrame(frame){
	
	
	var stringArray="";
	for(var i=0;i<frame.length;i++){
		if(i>0){
			stringArray+="|"
		}
		stringArray+=frame[i][0]+","+frame[i][1]+","+frame[i][2];
		
	}

	//var message = new Buffer('[kazoosh]||200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55|200,100,55');
	var message = new Buffer('[kazoosh]||'+stringArray);
	
	client.send(message, 0, message.length, PORT, HOST, function(err, bytes) {
		if (err) throw err;
		//console.log('UDP message sent to ' + HOST +':'+ PORT);
		//client.close();
	});
	if(enableWebInterface){
		var joined=[];
		for(var i=0;i<frame.length;i++){
			joined.push(frame[i][0])
			joined.push(frame[i][1])
			joined.push(frame[i][2])
		}
	
		//broadcast to all connected clients
		app.io.broadcast('newFrame', joined);		
	}

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


