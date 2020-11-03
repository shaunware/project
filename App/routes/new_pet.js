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
var insert_category_query = 'INSERT INTO PetCategories VALUES ';
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
var categoryErr = "";

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
	userid = req.params.userid; //TODO: Need to replace with user session id
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
				categoryErr: "",
				requirements: "",
				userid: req.params.userid
			});
		} else {
			res.render('not_found_error', {component: 'userid'});
		}
	} else {
		res.render('connection_error');
	}
});

// POST
router.post('/:userid', function(req, res, next) {
	// Retrieve Information
	var petid  = req.body.petid.toLowerCase().trim();
	var name    = req.body.name.trim();
	var category = req.body.category;
	var owner = req.params.userid; //TODO: Need to replace with user session id
	var requirements = req.body.requirements;
	var newCategory = req.body.newCategory.toString().trim().toLowerCase();

	// Validation
	var found_petid;
	pool.query(pet_exist_query, [petid], (err, data) => {
		found_petid = data.rows.length > 0;
	});
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
	if (newCategory !== "") {
		var isValid = true;
		var str = newCategory;
		var len = str.length;
		for (var i=0; i<len && isValid; i++) {
			var c = str.charAt(i);
			if (!((c < 'z' && c > 'a') || (c = ' '))) {
				isValid = false;
				categoryErr = "* The pet category should consist of letters and white space only.";
			}
		}
		if (isValid) {
			console.log(newCategory);
			categoryErr = "";
			category = newCategory;
			pool.query(category_exist_query, [category], (err, data) => {
				if (data.rows.length === 0) {
					pool.query(insert_category_query + "('" + category + "')", (err, data) => {
						console.log("Inserted new category: " + category);
					});
				}
			});
		}
	} else {
		categoryErr = "";
	}

	if (petidErr === "" && nameErr === "" && categoryErr === "") {
		// Construct Specific SQL Query
		var insert_query = insert_pet_query + "('" + petid + "','" + name + "','" + category + "','" + owner + "','" + requirements + "')";

		pool.query(insert_query, (err, data) => {
			console.log("Inserted new pet: { petid:" + petid + ", name:" + name + ", category:" + category + ", owner:" + owner + ", requirements:" + requirements + "}" )
			res.redirect('/test'); //TODO: Need to update to pet view page
		});
	} else {
		res.render('new_pet', {
			title: 'Add New Pet',
			categories: categories,
			petid: petid,
			petidErr: petidErr,
			name: name,
			nameErr: nameErr,
			category: category,
			categoryErr: categoryErr,
			requirements: requirements,
			userid: req.params.userid
		});
	}
});

module.exports = router;
