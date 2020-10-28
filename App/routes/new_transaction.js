var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var all_petowner_query = 'SELECT 1 FROM PetOwners';
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1';
var pet_exist_query = 'SELECT * FROM Pets WHERE petid=$1 AND owner=$2';
var request_exist_query = 'SELECT s_date, e_date, transfer_type, payment_type FROM Requests WHERE pet_id=$1 AND s_date=$2';
var existing_transaction_query = 'SELECT T.ct_id AS ct_id, T.cost AS cost, C.rating AS rating, T.status AS status,\n' +
	'       CASE WHEN EXISTS(SELECT 1 FROM FullTimeCareTakers F WHERE F.userid=C.userid) THEN \'Full time\' ELSE \'Part time\' END AS ct_category\n' +
	'  FROM Transactions T INNER JOIN CareTakers C ON T.ct_id=C.userid\n' +
	'  WHERE T.pet_id=$1 AND T.s_date=$2 AND T.status<>\'Withdrawn\''
/*
SELECT T.ct_id AS ct_id, T.cost AS cost, C.rating AS rating, T.status AS status,
       CASE WHEN EXISTS(SELECT 1 FROM FullTimeCareTakers F WHERE F.userid=C.userid) THEN 'Full time' ELSE 'Part time' END AS ct_category
  FROM Transactions T INNER JOIN CareTakers C ON T.ct_id=C.userid
  WHERE T.pet_id={$1=this petid} AND T.s_date={$2=this s_date} AND T.status<>'Withdrawn'
 */

/* Data */
var userid;
var petid;
var pet;
var petName;
var category;
var s_date;
var e_date;
var transfer_type;
var payment_method;
var existing_transactions;

/* Util */
var getString = (date) => date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
var refreshPage = (res) => {
	res.render('new_transaction', {
		title: 'Find Care Taker for your ' + category + ' ' + petName,
		petid: petid,
		s_date: getString(s_date),
		e_date: getString(e_date),
		transfer_type: transfer_type,
		payment_method: payment_method,
		existing_transactions: existing_transactions
	});
}

/* Err msg */

// GET
router.get('/:userid/:petid/:s_date', function(req, res, next) {
	userid = req.params.userid; //TODO: May need to update with session user id
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	pool.query(all_petowner_query, (err, data) => {
		if (err !== undefined) {
			res.render('connection_error');
		} else {
			pool.query(petowner_exist_query, [userid], (err, data) => {
				if (data.rows.length > 0) {
					pool.query(pet_exist_query, [petid, userid], (err, data) => {
						if (data.rows.length > 0) {
							pet = data.rows;
							petName = pet[0].name;
							category = pet[0].category;
							pool.query(request_exist_query, [petid, getString(s_date)], (err, data) => {
								if (data.rows.length > 0) {
									var request = data.rows[0];
									e_date = request.e_date;
									transfer_type = request.transfer_type;
									payment_method = request.payment_type;
									pool.query(existing_transaction_query, [petid, getString(s_date)], (err, data) => {
										existing_transactions = data.rows;
										refreshPage(res);
									})
								} else {
									res.render('not_found_error', {component: 'request'});
								}
							})
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

});

module.exports = router;

