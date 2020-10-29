var express = require('express');
var router = express.Router();
var url = require('url');
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
var allocate_query = 'SELECT allocate_success($1, $2, $3)';
/*
SELECT CTC.ct_id
  FROM CanTakeCare CTC
  WHERE category={$1=this category}
    AND is_available(ct_id, {$2=s_date},{$3=e_date})
    AND CTC.ct_id=ANY(SELECT userid FROM FullTimeCareTakers)
 */
var delete_request_query = 'DELETE FROM Requests WHERE pet_id=$1 AND s_date=$2';
var delete_empty_request_qeury = 'CALL delete_empty_request($1, $2)';
var withdraw_query = 'UPDATE Transactions SET status=\'Withdrawn\' WHERE pet_id=$1 AND s_date=$2 AND ct_id=$3';

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
	res.render('handle_transactions', {
		title: 'Find Care Taker for your ' + category + ' ' + petName,
		petid: petid,
		s_date: getString(s_date),
		e_date: getString(e_date),
		transfer_type: transfer_type,
		payment_method: payment_method,
		existing_transactions: existing_transactions,
		allocate_unsuccessful_msg: allocate_unsuccessful_msg(category)
	});
}
var redirectHere = (res) => {
	res.redirect(url.format({
		pathname:"/handle_transactions/" + userid + "/" + petid + "/" + getString(s_date),
		query: {
			"allocate_unsuccessful": allocate_unsuccessful
		}
	}));
}

/* Err msg */
var allocate_unsuccessful = false;
var allocate_unsuccessful_msg = (category) => allocate_unsuccessful ? "* Sorry we cannot find any full-time care taker available declared " + category + " as a pet category that he or she can take care of." : "";

// GET
router.get('/:userid/:petid/:s_date', function(req, res, next) {
	userid = req.params.userid; //TODO: May need to update with session user id
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	allocate_unsuccessful = req.query.allocate_unsuccessful;
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
// ALLOCATE
router.post('/:userid/:petid/:s_date/allocate', function(req, res, next) {
	userid = req.params.userid;
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	pool.query(allocate_query, [petid, getString(s_date), getString(e_date)], (err, data) => {
		console.log(data.rows[0].allocate_success);
		if (data.rows[0].allocate_success) {
			console.log("Allocated the a full-time care taker for request of petid from " + getString(s_date) + " to " + getString(e_date));
			allocate_unsuccessful = false;
			res.redirect('/test'); // TODO: Should direct to the view request page.
		} else {
			allocate_unsuccessful = true;
			redirectHere(res);
		}
	})
});

// DELETE REQUEST
router.post('/:userid/:petid/:s_date/delete', function (req, res, next) {
	userid = req.params.userid;
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	pool.query(delete_request_query, [petid, s_date], (err, data) => {
		console.log("Deleted the query and all transactions of " + petid + " on " + getString(s_date));
		res.redirect('/test'); //TODO: Redirect to the view pet page
	})
});

// BACK
router.post('/:userid/:petid/:s_date/back', function (req, res, next) {
	userid = req.params.userid;
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	pool.query(delete_empty_request_qeury, [petid, s_date], (err, data) => {
		res.redirect('/test'); //TODO: Redirect to the view request page
	})
})

// WITHDRAW
router.post('/:userid/:petid/:s_date/:ct_id/withdraw', function(req, res, next) {
	userid = req.params.userid;
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	var ct_id = req.params.ct_id;
	pool.query(withdraw_query, [petid, getString(s_date), ct_id], (err, data) => {
		redirectHere(res);
	})
})

module.exports = router;

