/**
 * Created by GalenWeber on 4/26/16.
 */

var router = require('express').Router(),
    request = require('request'),
    keys = require('../../../server/env/index.js'),
    TELEGRAM_TOKEN = keys.TELEGRAM.token,
    FredService = require('../../services/fred_service.js');

// All messages are sent as post requests to this route
router.post('/' + TELEGRAM_TOKEN, function(req, res, next) {

    var message = req.body.message;

    console.log("the req.body is: ", req.body.message.text);

    // The message has text
    if (message && message.text) {
        Promise.resolve(parseText(message.text))
            .then(function fulfilled(parsedText) {
                if (parsedText.search) {
                    var searchPromise = FredService.search(parsedText.search);

                    var seriesPromise = searchPromise.then(function fulfilled(longResults) {
                        console.log("we have returned the long results");
                        if (longResults.seriess.length) {
                            return FredService.getSeries(longResults.seriess[0].id)
                        } else {
                            throw new Error('no results');
                            sendText("No results found. Please adjust search terms.", message.chat.id)
                                .then(function fulfilled(telegramResponse) {
                                    res.sendStatus(200);
                                });
                        }
                    });

                    return Promise.all([searchPromise, seriesPromise]).then(function(values) {
                        console.log("we have got values: ", values[0].seriess[0]);
                        var series = values[0].seriess[0];
                        var dataPoint = values[1].observations[values[1].observations.length-1];


                        var htmlString = `${dataPoint.value + ' ' + series.units_short} \n${series.title} \n<i>Data for: ${dataPoint.date}</i>`;

                        sendText(htmlString, message.chat.id)
                            .then(function fulfilled(telegramResponse) {
                                res.sendStatus(200);
                            });

                    })

                }
            })
            .catch(function rejected(error) {


                if (error.message === 'no results') {
                    sendText("No results found. Please adjust search terms.", message.chat.id)
                        .then(function fulfilled(telegramResponse) {
                            res.sendStatus(200);
                        });
                } else {
                    sendText("Error querying the server.", message.chat.id)
                        .then(function fulfilled(telegramResponse) {
                            res.sendStatus(200);
                        });
                }

            });

    } else {
        var queryParams = {
            chat_id: message.chat.id,
            text: "Sorry, I don't understand that message.",
            parse_mode: 'HTML'
        };

        request({
            url: 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage',
            qs: queryParams,
            method: 'POST'
        }, function optionalCallback(err, httpResponse, body) {
            if (err) {
                return console.error('upload failed:', err);
            }
            res.sendStatus(200);
        });
    }


});

var parseText = function(text) {
    if (true) {
        return {search:text}
    }
};

var sendText = function(text, recipient) {
    var queryParams = {
        chat_id: recipient,
        text: text,
        parse_mode: 'HTML'
    };

    return new Promise(function(resolve, reject) {
        request({
            url: 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage',
            qs: queryParams,
            method: 'POST'
        }, function(err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

};


module.exports = router;