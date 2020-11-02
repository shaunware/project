var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

var getString = (date) => date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

var renderRequest = (res) => {
	res.render('request', {
		title: 'Your request of ' + petid + ' from ' + getString(s_date),
		petid: petid,
		s_date: getString(s_date)
	});
}

var renderTransaction = (res) => {
	res.render('transaction', {
		title: 'Your transaction of ' + petid + ' from ' + getString(s_date),
		petid: petid,
		s_date: getString(s_date)
	})
}

/* SQL Query */
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var pet_exist_query = 'SELECT 1 FROM Pets WHERE petid=$1 AND owner=$2';
var request_exist_query = 'SELECT 1 FROM Requests WHERE pet_id=$1 AND s_date=$2'
var confirmed_transaction_exist_query = 'SELECT 1 FROM Transactions WHERE pet_id=$1 AND s_date=$2 AND status=\'Confirmed\'';

/* Data */
var userid;
var petid;
var s_date;

/* Err msg */

// GET
router.get('/:userid/:petid/:s_date', function(req, res, next) {
	userid = req.params.userid; //TODO: Need to replace with user session id
	pool.query(petowner_exist_query, [userid], (err, data) => {
		if (err !== undefined) {
			res.render('connection_error');
		} else {
			if (data.rows.length > 0) {
				petid = req.params.petid;
				s_date = new Date(req.params.s_date);
				pool.query(pet_exist_query, [petid, userid], (err, data) => {
					if (data.rows.length > 0) {
						pool.query(request_exist_query, [petid, getString(s_date)], (err, data) => {
							if (data.rows.length > 0) {
								pool.query(confirmed_transaction_exist_query, [petid, getString(s_date)], (err, data) => {
									if (data.rows.length > 0) {
										renderTransaction(res);
									} else {
										renderRequest(res);
									}
								})
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
