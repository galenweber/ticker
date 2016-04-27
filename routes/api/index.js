'use strict';
var router = require('express').Router();

module.exports = router;
router.use('/messenger', require('./messenger/messenger.js'));
router.use('/telegram', require('./telegram/telegram.js'));

// Make sure this is after all of
// the registered routes!
router.use(function (req, res) {
    res.status(404).end();
});