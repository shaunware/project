var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* Util */
var getString = (date) => date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

var renderTransaction = (res) => {
	res.render('transaction', {
		title: 'Transaction',
		petid: petid,
		s_date: getString(s_date),
		e_date: getString(transaction.e_date),
		transaction: transaction
	})
}

var renderRequest = (res) => {
	res.render('request', {
		title: 'Request',
		userid: userid,
		petid: petid,
		s_date: getString(s_date),
		e_date: getString(request.e_date),
		pet: pet,
		request: request,
		caretakers: caretakers
	})
}

/* SQL Query */
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var pet_exist_query = 'SELECT * FROM Pets WHERE petid=$1 AND owner=$2';
var request_exist_query = 'SELECT * FROM Requests WHERE pet_id=$1 AND s_date=$2'
var confirmed_transaction_exist_query = 'SELECT T.pet_id AS pet_id, T.s_date AS s_date, R.e_date AS e_date, T.ct_id AS ct_id, P.name AS pet_name, P.category AS pet_category,\n' +
	'  R.transfer_type AS transfer_type, R.payment_type AS payment_type, T.cost AS cost, T.rate AS rate, T.review AS review\n' +
	'FROM (Transactions T NATURAL JOIN Requests R) INNER JOIN Pets P ON R.pet_id=P.petid\n' +
	'WHERE pet_id=$1 AND s_date=$2 AND status=\'Confirmed\'';
/*
SELECT T.pet_id AS pet_id, T.s_date AS s_date, R.e_date AS e_date, T.ct_id AS ct_id, P.name AS pet_name, P.category AS pet_category,
  R.transfer_type AS transfer_type, R.payment_type AS payment_type, T.cost AS cost, T.rate AS rate, T.review AS review
FROM (Transactions T NATURAL JOIN Requests R) INNER JOIN Pets P ON R.pet_id=P.petid
WHERE pet_id=$1 AND s_date=$2 AND status='Confirmed'
 */
var save_rate_query = 'UPDATE Transactions SET rate=$1 WHERE pet_id=$2 AND s_date=$3 AND status=\'Confirmed\'';
var save_review_query = 'UPDATE Transactions SET review=$1 WHERE pet_id=$2 AND s_date=$3 AND status=\'Confirmed\'';
var all_ct_query = 'SELECT T.ct_id AS ct_id, U.name AS name, T.status AS status, T.cost AS cost\n' +
	'FROM Transactions T INNER JOIN Users U ON U.userid=T.ct_id\n' +
	'WHERE T.pet_id=$1 AND T.s_date=$2';
/*
SELECT T.ct_id AS ct_id, U.name AS name, T.status AS status
FROM Transactions T INNER JOIN Users U ON U.userid=T.ct_id
WHERE T.pet_id=$1 AND T.s_date=$2
 */

/* Data */
var userid;
var petid;
var s_date;
var pet;
var transaction;
var request;
var caretakers;

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
						pet = data.rows[0];
						pool.query(request_exist_query, [petid, getString(s_date)], (err, data) => {
							if (data.rows.length > 0) {
								request = data.rows[0];
								pool.query(confirmed_transaction_exist_query, [petid, getString(s_date)], (err, data) => {
									if (data.rows.length > 0) {
										transaction = data.rows[0];
										renderTransaction(res);
									} else {
										transaction = null;
										pool.query(all_ct_query, [petid, getString(s_date)], (err, data) => {
											caretakers = data.rows;
											renderRequest(res);
										});
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
router.post('/:userid/:petid/:s_date/review', function(req, res, next) {
	userid = req.params.userid; //TODO: Need to replace with user session id
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	var rate = req.body.rate;
	var review = req.body.review;
	pool.query(save_rate_query, [rate, petid, getString(s_date)], (err, data) => {
		console.log("Update rate to " + rate);
		pool.query(save_review_query, [review, petid, getString(s_date)], (err, data) => {
			console.log("Update review");
			res.redirect("/request/" + userid + "/" + petid + "/" + getString(s_date));
		})
	});
});

module.exports = router;
