/**
 * Created by GalenWeber on 4/14/16.
 */

function insertLine(selector, w, h, data) {
    var el = window.document.querySelector(selector);

    // Parse the date / time
    var parseDate = d3.time.format("%Y-%m-%d").parse;

    data.forEach(function(d) {
        d.x = parseDate(d.x);
    });

    var vis = d3.select(el),
        WIDTH = w,
        HEIGHT = h,
        MARGINS = {
            top: 150,
            right: 100,
            bottom: 150,
            left: 100
        },
        xRange = d3.time.scale().range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(data, function(d) {
            return d.x;
        }), d3.max(data, function(d) {
            return d.x;
        })]),
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
            .tickSize(5)
            .orient('left')
            .tickSubdivide(true);

    vis.append('svg:g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (HEIGHT - MARGINS.bottom) + ')')
        .call(xAxis);

    vis.append('svg:g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + (MARGINS.left) + ',0)')
        .call(yAxis);

    var lineFunc = d3.svg.line()
        .x(function(d) {
            return xRange(d.x);
        })
        .y(function(d) {
            return yRange(d.y);
        })
        .interpolate('linear');

    vis.append('svg:path')
        .attr('d', lineFunc(data))
        .attr('stroke', 'blue')
        .attr('stroke-width', 2)
        .attr('fill', 'none');
    
    return el;
}