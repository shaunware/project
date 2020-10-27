var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var all_petowner_query = 'SELECT userid FROM PetOwners';
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var all_pets_query = 'SELECT petid FROM Pets';
var all_categories_query = 'SELECT * FROM PetCategories ORDER BY name';
var insert_pet_query = 'INSERT INTO Pets VALUES ';

/* Data */
var userid;
var petOwners;
var pets;
var categories;

/* Err msg */
var connectionSuccess;
var isPetOwner;
var petidErr = "";
var nameErr = "";

// GET
router.get('/:userid', function(req, res, next) {
	pool.query(all_petowner_query, (err, data) => {
		if (err !== undefined) {
			connectionSuccess = false;
		} else {
			connectionSuccess = true;
			petOwners = data.rows;
		}
	});
	userid = req.params.userid;
	if (connectionSuccess) {
		pool.query(petowner_exist_query, [userid], (err, data) => {
			isPetOwner = data.rows.length > 0;
		});
		if (isPetOwner) {
			pool.query(all_pets_query, (err, data) => {
				pets = data.rows;
			});
			pool.query(all_categories_query, (err, data) => {
				categories = data.rows;
			});
			res.render('new_pet', {
				title: 'Add New Pet',
				categories: categories,
				petid: "",
				petidErr: "",
				name: "",
				nameErr: "",
				category: "",
				requirements: "",
				userid: req.params.userid
			});
		} else {

		}
	} else {
		res.render('connection_error');
	}
});

// POST
router.post('/:userid', function(req, res, next) {
	// Retrieve Information
	var petid  = req.body.petid;
	var name    = req.body.name;
	var category = req.body.category;
	var owner = req.params.userid;
	var requirements = req.body.requirements;
	var newCategory = req.body.newCategory.toString().trim();

	// Validation
	var found_petid;
	for (var i=0; i<pets.length; i++) {
		if (petid === pets[i].petid) {
			found_petid = true;
			break;
		}
	}
	if (found_petid) {
		petidErr = "* The pet id already exists. Please choose another pet id.";
	} else if (petid === "") {
		petidErr = "* The pet id cannot be empty. Please provide an id.";
	} else {
		var isValid = true;
		var str = petid.toString();
		var len = str.length;
		for (var i=0; i<len && isValid; i++) {
			var c = str.charAt(i);
			if (!((c < 'Z' && c > 'A') || (c < 'z' && c > 'a') || (c < '9' && c > '0') || (c = '-'))) {
				isValid = false;
				petidErr = "* The pet id should consist of letters, numbers, and - only.";
			}
		}
		if (isValid) {
			petidErr = "";
		}
	}
	if (name === "") {
		nameErr = "* The pet name should not be empty. Please provide a name.";
	} else {
		nameErr = "";
	}

	if (petidErr === "" && nameErr === "") {
		// Construct Specific SQL Query
		var insert_query = insert_pet_query + "('" + petid + "','" + name + "','" + category + "','" + owner + "','" + requirements + "')";

		pool.query(insert_query, (err, data) => {
			res.redirect('/test'); //TODO: Need to update
		});
	} else {
		res.render('new_pet', { title: 'Add New Pet', categories: categories,
			petid: petid, petidErr: petidErr, name: name, nameErr: nameErr, category: category, requirements: requirements, userid: req.params.userid });
	}
});

module.exports = router;
