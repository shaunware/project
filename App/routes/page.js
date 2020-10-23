var express = require('express');
var router = express.Router();

router.get('/page', function(req, res, next) {
  res.render('page', { title: 'Page', author: 'Adi'});
});

module.exports = router;
