var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var all_petowner_query = 'SELECT userid FROM PetOwners';
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var all_pets_query = 'SELECT petid FROM Pets';
var pet_exist_query = 'SELECT 1 FROM Pets WHERE petid=$1';
var all_categories_query = 'SELECT * FROM PetCategories ORDER BY name';
var category_exist_query = 'SELECT 1 FROM PetCategories WHERE name=$1';
var delete_pet_query = 'DELETE FROM Pets WHERE petid=$1 AND userid=$2 ';

var owners_pets = 'SELECT * FROM Pets';

/* Data */
var userid;
var pets;


/* Err msg */
var connectionSuccess;
var isPetOwner;
var petidErr = "";
var nameErr = "";
var categoryErr = "";

//GET
router.get('/:userid', function(req, res, next) {
	pool.query(all_petowner_query, (err, data) => {
		if (err !== undefined) {
			connectionSuccess = false;
		} else {
			connectionSuccess = true;
			petOwners = data.rows;
		}
	});
	userid = req.params.userid; //TODO: Need to replace with user session id
	if (connectionSuccess) {
		pool.query(petowner_exist_query, [userid], (err, data) => {
			isPetOwner = data.rows.length > 0;
		});
		if (isPetOwner) {
			pool.query(owners_pets, (err, data) => {
				pets = data.rows;
			});
			pool.query(all_categories_query, (err, data) => {
				categories = data.rows;
			});
			res.render('pets', {
				title: 'Pets',
				userid: req.params.userid,
				pets: pets
			});
		} else {
			res.render('not_found_error', {component: 'userid'});
		}
	} else {
		res.render('connection_error');
	}
});

//DELETE
router.post('/:userid', function(req, res, next) {
	// Retrieve Information
	var petid  = req.body.petid.toLowerCase().trim();
	var owner = req.params.userid; //TODO: Need to replace with user session id

	// Construct Specific SQL Query
	//var delete_pet_query = insert_pet_query + "('" + petid + "','" + name + "','" + category + "','" + owner + "','" + requirements + "')";

	pool.query(delete_pet_query, [petid, owner], (err, data) => {
			console.log(" Deleted " + owner + "'s pet " + petid);
			res.redirect('/test'); //TODO: Need to update to pet view page
		});

		res.render('pet', {
			title: 'Pets',
            userid: req.params.userid,
            pets: pets
		});

});
module.exports = router;