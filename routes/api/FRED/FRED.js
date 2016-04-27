/**
 * Created by GalenWeber on 4/20/16.
 */
const FRED_API_ENPOINT = 'https://api.stlouisfed.org/fred/',
    qs = require('querystring'),
    http= require('https');

var FRED = function(apiKey) {

    return function(options) {

        var requestUrl, queryString;

        queryString = '?' + qs.stringify({
            series_id: options.series,
            search_text: options.text,
            api_key: apiKey,
            file_type: 'json'
        });

        requestUrl = FRED_API_ENPOINT + options.method.replace('-','/') + queryString;


        var requestPromise = new Promise (function(resolve, reject) {
            return http.get(requestUrl, function(response) {
                var body = '';

                response.on('data', function(chunk) {
                    body += chunk;
                });

                response.on('end', function() {
                    if (false) {
                        // handle error
                    } else {
                        console.log("we are resolving");
                        resolve(JSON.parse(body));
                    }
                })

            })
        });

        return requestPromise;

    }

};

module.exports = FRED;