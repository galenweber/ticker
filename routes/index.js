var express = require('express');
var path = require('path');
var router = express.Router();


var rootPath = path.join(__dirname, '../'),
    indexPath = path.join(rootPath, './views/index.html');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(indexPath);
});

module.exports = router;
