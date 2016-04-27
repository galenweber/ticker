
var keys = require('../../server/env/index.js'),
    FRED_API_KEY = keys.FRED.apiKey,
    Fred = require('../api/FRED/FRED.js')(FRED_API_KEY);

var search = function(text) {

    var optionsObj = {
        method: 'series-search',
        text: text
    };

    return Fred(optionsObj)

};

var cullSearch = function(results) {
    // Oddly it appears the property name is 'seriess'
    results = results.seriess.slice(0,3);

    // returns an object with property results
    return {results};
};

var getSeries = function(id) {

    var optionsObj = {
        method: 'series-observations',
        series: id
    };

    return Fred(optionsObj);
};

var getSeriesAndInfo = function(id) {
    var observationsObj = {
        method: 'series-observations',
        series: id
    };

    var infoObj = {
        method: 'series',
        series: id
    };

    return Promise.all([Fred(observationsObj), Fred(infoObj)])

};

module.exports = {search, cullSearch, getSeries, getSeriesAndInfo};