var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var all_pets_query = 'SELECT petid FROM Pets';
var all_categories_query = 'SELECT * FROM PetCategories ORDER BY name';
var sql_query = 'INSERT INTO Pets VALUES ';

/* Data */
var pets;
var categories;

// GET
router.get('/:userid', function(req, res, next) {
	pool.query(all_pets_query, (err, data) => {
		pets = data.rows;
	})
	pool.query(all_categories_query, (err, data) => {
		categories = data.rows;
	})
	res.render('new_pet', { title: 'Add New Pet', pets: pets, categories: categories, userid: req.params.userid});
});

// POST
router.post('/:userid', function(req, res, next) {
	// Retrieve Information
	var petid  = req.body.petid;
	var name    = req.body.name;
	var category = req.body.category;
	var owner = req.params.userid;
	var requirement = req.body.requirements;

	// Construct Specific SQL Query
	var insert_query = sql_query + "('" + petid + "','" + name + "','" + category + "','" + owner + "','" + requirement + "')";
	
	pool.query(insert_query, (err, data) => {
		res.redirect('/test')
	});
});

module.exports = router;
