/**
 * Created by GalenWeber on 8/12/15.
 */
var router = require('express').Router(),
    request = require('request'),
    keys = require('../../../server/env/index.js'),
    fs = require('fs'),
    jsdom = require("jsdom").jsdom,
    d3 = require("d3"),
    FRED_API_KEY = keys.FRED.apiKey,
    Fred = require('../FRED/index.js')(FRED_API_KEY),
    MESSENGER_TOKEN = keys.MESSENGER.token,
    svg2png = require("svg2png");

// This is the confirmation webhook facebook uses
router.get('/', function(req, res, next) {
    if (req.query['hub.verify_token'] === 'chirp') {
        res.status(200).send(req.query['hub.challenge']);
    }
    res.json('Error, wrong validation token');
});

// All messages are sent as post requests to this route
router.post('/', function(req, res, next) {

    var messaging_events = req.body.entry[0].messaging;

    for (var i = 0; i < messaging_events.length; i++) {
        var event = req.body.entry[0].messaging[i];
        var sender = event.sender.id;
        var text = '';
        if (event.message && event.message.text) {
            // Text message not postback
            text = event.message.text;
        }

        if (event.postback) {
            // Event is postback, pull text from payload
            text = event.postback.payload;
        }
    }

    Promise.resolve(handleText(sender, text)).then(function fulfilled(result) {
        res.sendStatus(200);
    }, function rejected(error) {
        console.log("ERRROR!!: ", error);
        res.sendStatus(200);
    });

});

function handleText(sender, text) {

    var command = parseCommand(text);

    if (command.ticker) {

        return getDataAndInfo(command.ticker)
            .then(function fulfilled(data) {
                return parseData(data);
            })
            .then(function fulfilled(cleanData) {
                return genChart(cleanData, sender);
            })
            .then(function fulfilled(filename) {
                return sendChart(filename);
            })

    } else if (command.search) {

        return searchFRED(command.search)
            .then(function fulfilled(results) {
                // results is an object as returned from our FRED module
                return parseSearch(results);
            })
            .then(function fulfilled(cleanResults) {
                // cleanResults is an object {results} with top three
                return sendSearchTemplates(cleanResults.results, sender);
            })
    }
}

function parseCommand(text) {
    if (text.indexOf('.') !== -1) {
        // It's a ticker
        var ticker = text.split('.')[1];

        return {ticker};

    } else {
        // Text search
        return {search:text};

    }
}

var getDataAndInfo = function(ticker) {
    var observationsObj = {
        method: 'series-observations',
        series: ticker
    };

    var infoObj = {
        method: 'series',
        series: ticker
    };

    return Promise.all([Fred(observationsObj), Fred(infoObj)])
};

var parseData = function(values) {
    var data = values[0];
    var seriesInfo = values[1];

    var xLabel = 'Date, ' + seriesInfo.seriess[0].frequency;
    var yLabel = seriesInfo.seriess[0].units;
    var name = seriesInfo.seriess[0].title;
    var lastUpdated = seriesInfo.seriess[0].last_updated;


    data = data.observations.map(function (elem) {

        return {
            x: elem.date,
            y: elem.value
        }

    });

    // ES6 shorthand property name notation
    return {data, xLabel, yLabel, name, lastUpdated};
};

var searchFRED = function(text) {

    var searchOptions = {
        method: 'series-search',
        text: text
    };

    return Fred(searchOptions)
};

var parseSearch = function(results) {
    // Oddly it appears the property name is 'seriess'
    //process.stdout.write(results);
    results = results.seriess.slice(0,3);

    // returns an array
    return {results};
};


var sendSearchTemplates = function (results, sender) {

    var elementsArray = [];

    console.log("our results are: ", results);

    results.forEach(function (element) {
        elementsArray.push({
            "title": element.title,
            "subtitle": element.units,
            "buttons": [{
                "type": "postback",
                "title": 'FRED.' + element.id,
                "payload": 'FRED.' + element.id
            }]
        })
    });

    console.log("the elements array is: ", elementsArray);

    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": elementsArray
            }
        }
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:MESSENGER_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });

};

var genChart = function(dataset, filename) {
    console.log("generating chart: ");

    var width = 1910,
        height = 1000,
        htmlStub = '<!DOCTYPE html><div id="line" style="width:'+width+'px;height:'+height+'px;"></div>',
        data = dataset.data,
        xLabel = dataset.xLabel,
        yLabel = dataset.yLabel,
        name = dataset.name;

    var document = jsdom(htmlStub, {
            features: {
                FetchExternalResources : {QuerySelector: true}
            }
        });


    return new Promise(function (resolve, reject) {

        var el = document.querySelector("#line");
        var fontFamily = 'Lucida Grande,Lucida,verdana,arial,sans-serif';

        // Parse the date / time, Fred does Y,M,D
        var parseDate = d3.time.format("%Y-%m-%d").parse;

        data.forEach(function(d) {
            // Convert the x-axis to dates
            d.x = parseDate(d.x);
            //Convert y-axis to numbers NOT strings
            d.y = +d.y;
        });

        data = data.filter(function (d) {
            // We need to filter out blanks and non-numbers
            return (typeof d.y === 'number' && !isNaN(d.y))
        });

        var minDate = data[0].x;
        var maxDate = data[data.length-1].x;
        var daySpan = (maxDate-minDate)/(1000*60*60*24);
        var dayAdd = Math.round(daySpan/20);
        var newMax = new Date();
        newMax.setDate(maxDate.getDate() + dayAdd);
        console.log("max date is: ", maxDate);
        console.log("newMax date is: ", newMax);

        var svg = d3.select(el),
            WIDTH = width,
            HEIGHT = height,
            MARGINS = {
                top: 150,
                right: 100,
                bottom: 150,
                left: 100
            },
            xRange = d3.time.scale().nice(1000).range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(data, function(d) {
                return d.x;
            }), newMax]),
            yRange = d3.scale.linear().range([HEIGHT - MARGINS.top, MARGINS.bottom]).domain([d3.min(data, function(d) {
                return d.y;
            }), d3.max(data, function(d) {
                return d.y;
            })]),
            xAxis = d3.svg.axis()
                .scale(xRange)
                .tickSize(5)
                .tickSubdivide(true),
            yAxis = d3.svg.axis()
                .scale(yRange)
                .orient("left")
                .innerTickSize(-width)
                .outerTickSize(0)
                .tickPadding(10);

        svg.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", "#E1E9F0");

        svg.append("rect")
            .attr("width", WIDTH - MARGINS.left - MARGINS.right)
            .attr("height", HEIGHT - MARGINS.top - MARGINS.bottom)
            .attr('transform', 'translate('+ MARGINS.left + ', ' + MARGINS.top + ')')
            .attr("fill", "White");

        svg.append('svg:g')
            .attr('class', 'x axis')
            .style({'font-size': '30px', 'font-family': 'Helvetica Neue,Helvetica,Arial,sans-serif'})
            .attr('transform', 'translate(0,' + (HEIGHT - MARGINS.bottom) + ')')
            .call(xAxis);

        svg.append('svg:g')
            .attr('class', 'y axis')
            .style({'font-size': '30px', 'font-family': 'Helvetica Neue,Helvetica,Arial,sans-serif'})
            .attr('transform', 'translate(' + (MARGINS.left) + ',0)')
            .call(yAxis);

        svg.selectAll("line.horizontalGrid").data(yRange.ticks(9)).enter()
            .append("line")
            .attr(
                {
                    "class":"horizontalGrid",
                    "x1" : MARGINS.right,
                    "x2" : WIDTH - MARGINS.right,
                    "y1" : function(d){ return yRange(d);},
                    "y2" : function(d){ return yRange(d);},
                    "fill" : "none",
                    "shape-rendering" : "crispEdges",
                    "stroke" : "#D8D8D8",
                    "stroke-width" : "1px"
                });

        var lineFunc = d3.svg.line()
            .defined(function(d) {return d.y})
            .x(function(d) {
                return xRange(d.x);
            })
            .y(function(d) {
                return yRange(d.y);
            })
            .interpolate('linear');

        svg.append('svg:path')
            .attr('d', lineFunc(data))
            .attr('stroke', '#4572A7')
            .attr('stroke-width', 4)
            .attr('fill', 'none');

        svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "end")
            .attr("x", width - 100)
            .attr("y", height - 80)
            .style({'font-size': '30px', 'font-family': fontFamily, 'color':'#333'})
            .text(xLabel);

        svg.append("text")
            .attr("class", "y label")
            .attr("text-anchor", "start")
            .attr("x", 80)
            .attr("y", 120)
            .style({'font-size': '30px', 'font-family': fontFamily, 'color':'#333'})
            .text(yLabel);

        svg.append("text")
            .attr("class", "title")
            .attr("text-anchor", "start")
            .attr("x", 80)
            .attr("y", 70)
            .style({'font-size': '60px', 'font-family': fontFamily, 'color':'#333'})
            .text(name);


        var svgsrc = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"' +
            ' xmlns:xlink="http://www.w3.org/1999/xlink">' + el.innerHTML + '</svg>';

        const buf1 = new Buffer(svgsrc);

        var p1 = Promise.resolve();

        p1.then(function() {
            console.log("converting to png");
            return svg2png(buf1, { width: 1910, height: 1000 });
        }).then(function (buffer) {
            console.log("writing file to server");
            fs.writeFile(__dirname + '/images/' + filename + '.png', buffer);
            resolve(filename);
        }, function rejected(error) {
            console.log("error is: ", error);
            reject();
        });


    });

};

function sendTextMessage(sender, text) {
    var messageData = {
        text:text
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:MESSENGER_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData
        }
    }, function(error, response, body) {
        //console.log("response is: ", response);
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}



var sendChart = function(sender) {
    console.log("sending chart");

    var messageData = {
        "attachment": {
            "type": "image",
            "payload": {}
        }
    };


    var formData = {
        recipient: JSON.stringify({id:sender}),
        message: JSON.stringify(messageData),
        // Pass data via Streams
        filedata: fs.createReadStream(__dirname + '/images/' + sender + '.png')
    };


    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:MESSENGER_TOKEN},
        method: 'POST',
        formData: formData
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Upload successful!  Server responded with:', body);
    });

};

module.exports = router;