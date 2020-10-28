var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var all_petowner_query = 'SELECT userid FROM PetOwners';
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var pet_exist_query = 'SELECT * FROM Pets WHERE petid=$1 AND owner=$2';
var conflicting_query = 'SELECT s_date, e_date FROM Requests WHERE pet_id=$1 AND are_conflicting_periods(s_date, e_date, $2, $3)';
var submit_request_query = 'INSERT INTO Requests VALUES ($1, $2, $4, $5, $3)'

/* Data */
var userid;
var petid;
var pet;
var petName;
var category;
var requirements;
var petOwners;
var s_date;
var e_date;
var transfer_type;
var payment_method;

/* Util */
var getString = (date) => date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
var compareDates = (d1, d2) => {
	if (d1.getFullYear() > d2.getFullYear()) {
		return 1;
	} else if (d1.getFullYear() < d2.getFullYear()) {
		return -1;
	} else if (d1.getMonth() > d2.getMonth()) {
		return 1;
	} else if (d1.getMonth() < d2.getMonth()) {
		return -1;
	} else if (d1.getDate() > d2.getDate()) {
		return 1;
	} else if (d1.getDate() < d2.getDate()) {
		return -1;
	} else {
		return 0;
	}
}
var isIn2Years = d => {
	var d1 = new Date();
	d1.setFullYear(d1.getFullYear() + 2);
	return compareDates(d, d1) <= 0;
}
var refreshPage = (res) => {
	res.render('new_request', {
		title: 'Find Care Taker for ' + petName,
		petid: petid,
		category: category,
		requirements: requirements,
		s_date: getString(s_date),
		e_date: getString(e_date),
		sDateErr: sDateErr,
		eDateErr: eDateErr,
		dateConflictErr: dateConflictErr,
		transfer_type: transfer_type,
		payment_method: payment_method
	});
}

/* Err msg */
var sDateErr = "";
var eDateErr = "";
var dateConflictErr = "";

// GET
router.get('/:userid/:petid', function(req, res, next) {
	s_date = new Date();
	e_date = new Date(s_date);
	e_date.setDate(s_date.getDate() + 7);
	userid = req.params.userid; //TODO: May need to update with session user id
	petid = req.params.petid;
	pool.query(all_petowner_query, (err, data) => {
		if (err !== undefined) {
			res.render('connection_error');
		} else {
			petOwners = data.rows;
			pool.query(petowner_exist_query, [userid], (err, data) => {
				if (data.rows.length > 0) {
					pool.query(pet_exist_query, [petid, userid], (err, data) => {
						if (data.rows.length > 0) {
							pet = data.rows;
							petName = pet[0].name;
							category = pet[0].category;
							requirements = pet[0].requirements;
							refreshPage(res);
						} else {
							res.render('not_found_error', {component: 'petid'});
						}
					})
				} else {
					res.render('not_found_error', {component: 'userid'});
				}
			});
		}
	});
});

// POST
// SELECT
router.post('/:userid/:petid', function(req, res, next) {
	userid = req.params.userid;
	petid = req.params.petid;
	s_date = new Date(req.body.s_date.trim());
	e_date = new Date(req.body.e_date.trim());
	transfer_type = req.body.transfer_type;
	payment_method = req.body.payment_method;
	if (s_date.toString() === 'Invalid Date') {
		sDateErr = "* The start date format is not a valid date format.";
		s_date = new Date();
	} else if (compareDates(s_date, new Date()) < 0) {
		sDateErr = "* The start date should not be a date before today.";
	} else if (!isIn2Years(s_date)) {
		sDateErr = "* The start date should be within 2 years.";
	} else {
		sDateErr = "";
	}
	if (e_date.toString() === 'Invalid Date') {
		eDateErr = "* The end date format is not a valid date format.";
		e_date = new Date(s_date);
		e_date.setDate(s_date.getDate() + 7);
	} else if (compareDates(e_date, s_date) < 0) {
		eDateErr = "* The end date should be a date after start date.";
	} else if (!isIn2Years(e_date)) {
		eDateErr = "* The end date should be within 2 years.";
	} else {
		eDateErr = "";
	}
	if (sDateErr !== "" || eDateErr !== "") {
		dateConflictErr = "";
		refreshPage(res);
	} else {
		pool.query(conflicting_query, [petid, getString(s_date), getString(e_date)], (err, data) => {
			if (data.rows.length > 0) {
				dateConflictErr = "* There is conflicting request from " + getString(data.rows[0].s_date) + " to " + getString(data.rows[0].e_date) + ".";
				refreshPage(res);
			} else {
				dateConflictErr = "";
				pool.query(submit_request_query, [petid, getString(s_date), getString(e_date), transfer_type, payment_method], (err, data) => {
					if (err) {
						console.log(err);
					} else {
						res.redirect('../../../handle_transactions/' + userid + '/' + petid + '/' + getString(s_date));
					}
				})
			}
		})
	}
});

module.exports = router;

