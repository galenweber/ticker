var express = require('express');
var router = express.Router();
var path = require('path');

var rootPath = path.join(__dirname, '../'),
    indexPath = path.join(rootPath, './views/index.html');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.sendFile(indexPath);
});

module.exports = router;
