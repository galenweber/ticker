/**
 * Created by GalenWeber on 8/12/15.
 */
var router = require('express').Router(),
    request = require('request'),
    keys = require('../../../server/env/index.js'),
    fs = require('fs'),
    jsdom = require("jsdom").jsdom,
    d3 = require("d3"),
    FredService = require('../../services/fred_service.js'),
    ChartService = require('../../services/chart_service.js'),
    MESSENGER_TOKEN = keys.MESSENGER.token,
    svg2png = require("svg2png"),
    path = require('path');

// This is the confirmation webhook facebook uses
router.get('/', function(req, res, next) {
    if (req.query['hub.verify_token'] === 'chirp') {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.json('Error, wrong validation token');
    }
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

        return FredService.getSeriesAndInfo(command.ticker)
            .then(function fulfilled(data) {
                return parseData(data);
            })
            .then(function fulfilled(cleanData) {
                return ChartService.genChart(cleanData, sender);
            })
            .then(function fulfilled(filename) {
                return sendChart(filename);
            })

    } else if (command.search) {

        return FredService.search(command.search)
            .then(function fulfilled(results) {
                // results is an object as returned from our FRED module
                return FredService.cullSearch(results);
            })
            .then(function fulfilled(cleanResults) {
                // cleanResults is an object {results} with top three
                if (cleanResults.results.length) {
                    return sendSearchTemplates(cleanResults.results, sender);
                } else {
                    return sendTextMessage(sender, "No series found. Please adjust your search parameters.")
                }
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




var sendSearchTemplates = function (results, sender) {

    var elementsArray = [];

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
        filedata: fs.createReadStream(path.join(__dirname + '../../../../images/' + sender + '.png'))
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