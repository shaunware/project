var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var sql_query = 'INSERT INTO Pets VALUES';

// GET
router.get('/', function(req, res, next) {
	res.render('new_pet', { title: 'Add New Pet' });
});

// POST
router.post('/', function(req, res, next) {
	// Retrieve Information
	var petid  = req.body['petid'];
	var name    = req.body.name;
	var category = req.body.category;
	var requirement = req.body.requirements;
	
	// Construct Specific SQL Query
	var insert_query = sql_query + "('" + petid + "','" + name + "','" + category + "','" + requirement + "')";
	
	//pool.query(insert_query, (err, data) => {
	//	res.redirect('/select')
	//});
});

module.exports = router;
