var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

var getString = (date) => date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

/* SQL Query */
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var pet_exist_query = 'SELECT 1 FROM Pets WHERE petid=$1 AND owner=$2';
var request_exist_query = 'SELECT 1 FROM Requests WHERE pet_id=$1 AND s_date=$2'

/* Data */
var userid;
var petid;
var s_date;

/* Err msg */

// GET
router.get('/:userid/:petid/:s_date', function(req, res, next) {
	pool.query(petowner_exist_query, (err, data) => {
		if (err !== undefined) {
			res.render('connection_error');
		} else {
			if (data.rows.length > 0) {
				userid = req.params.userid; //TODO: Need to replace with user session id
				petid = req.params.petid;
				s_date = new Date(s_date);
				pool.query(pet_exist_query, [petid, userid], (err, data) => {
					if (data.rows.length > 0) {
						pool.query(request_exist_query, [petid, getString(s_date)], (err, data) => {
							if (data.rows.length > 0) {

							} else {
								res.render('not_found_error', {component: 'request'});
							}
						})
					} else {
						res.render('not_found_error', {component: 'pet id'});
					}
				})
			} else {
				res.render('not_found_error', {component: 'pet owner userid'});
			}
		}
	});
});

// POST
router.post('/:userid', function(req, res, next) {

});

module.exports = router;
