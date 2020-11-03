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
var confirmed_transaction_query = 'SELECT 1 FROM Transactions WHERE pet_id=$1 AND s_date=$2 AND status=\'Confirmed\'';
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
var request_all_query = () => {
	return 'SELECT send_request_success($11, $2, CT.userid) FROM (' + retrieve_ct_query() + safe_guard + ') CT';
}
var clear_all_query = 'UPDATE Transactions T1 SET status=\'Outdated\' WHERE status=\'Pending\' AND EXISTS(\n' +
	'    SELECT 1 FROM Transactions T2 WHERE T1.pet_id=T2.pet_id AND T1.s_date=T2.s_date AND T2.status=\'Confirmed\')'
var retrieve_ct_query = () => {
	var res = all_ct_query;
	if (id_contains !== "") { res = res + ct_id_filter; }
	if (name_contains !== "") { res = res + ct_name_filter; }
	if (ft_pt === 'full_time') {
		res = res + full_time_filter;
	} else if (ft_pt === 'part_time') {
		res = res + part_time_filter;
	}
	if (avg_rate > 0) { res = res + avg_rating_filter; }
	if (can_take_care) {
		res = res + can_take_care_filter;
		res = res + daily_price_filter;
		if (pc_experience) {
			res = res + experience_pc_filter;
			if (pc_avg_rate > 0) {
				res = res + pc_avg_rate_filter;
			}
		}
	}
	if (user_coll === 'requested') {
		res = res + history_requested_filter;
	} else if (user_coll === 'confirmed') {
		res = res + history_confirmed_filter;
		if (my_avg_rate > 0) {
			res = res + my_avg_rate_filter;
		}
		if (pet_coll === 'requested') {
			res = res + history_pet_requested_filter;
		} else if (pet_coll === 'confirmed') {
			res = res + history_pet_confirmed_filter;
		}
	}
	return res;
}
var all_ct_query = 'SELECT CT.userid AS userid, U.name AS name, CT.rating AS rating, CTC.daily_price AS daily_price,\n' +
	'  CASE WHEN EXISTS(SELECT 1 FROM FullTimeCareTakers F WHERE F.userid=CT.userid) THEN \'Full time\' ELSE \'Part time\' END AS category\n' +
	'FROM (Users U INNER JOIN CareTakers CT on U.userid = CT.userid) LEFT JOIN CanTakeCare CTC ON CT.userid=CTC.ct_id\n' +
	'WHERE $1 NOT IN (SELECT category FROM CannotTakeCare CN WHERE CN.ct_id=CT.userid)\n' +
	'AND is_available(CT.userid, $2, $3)\n' +
	'AND NOT EXISTS(SELECT 1 FROM Transactions T WHERE T.ct_id=CT.userid AND T.pet_id=$11 AND T.s_date=$2 AND (T.status=\'Pending\' OR T.status=\'Confirmed\' OR T.status=\'Declined\'))';
/*
SELECT CT.userid AS userid, U.name AS name, CT.rating AS rating, CTC.daily_price AS daily_price,
  CASE WHEN EXISTS(SELECT 1 FROM FullTimeCareTakers F WHERE F.userid=CT.userid) THEN 'Full time' ELSE 'Part time' END AS category
FROM (Users U INNER JOIN CareTakers CT on U.userid = CT.userid) LEFT JOIN CanTakeCare CTC ON CT.userid=CTC.ct_id
WHERE {$1=this category} NOT IN (SELECT category FROM CannotTakeCare CN WHERE CN.ct_id=CT.userid)
AND is_available(CT.userid, {$2=this s_date}, {$3=this e_date})
AND NOT EXISTS(SELECT 1 FROM Transactions T WHERE T.ct_id=CT.userid AND T.pet_id=$11 AND T.s_date=$2 AND (T.status='Pending' OR T.status='Confirmed' OR T.status='Declined'))
 */
var ct_id_filter = 'AND CT.userid LIKE \'%\'||$4||\'%\''; // $4 = userid contains
var ct_name_filter = 'AND U.name LIKE \'%\'||$5||\'%\''; // $5 = user name contains
var full_time_filter = 'AND CT.userid IN (SELECT F.userid FROM FullTimeCareTakers F)';
var part_time_filter = 'AND CT.userid IN (SELECT P.userid FROM PartTimeCareTakers P)';
var avg_rating_filter = 'AND CT.rating >= $6'; // $6 = average rating should be >= this
var can_take_care_filter = 'AND $1 IN (SELECT category FROM CanTakeCare C WHERE C.ct_id=CT.userid)';
var daily_price_filter = 'AND CTC.daily_price <= $7'; // $7 = daily price no larger than this
var experience_pc_filter = 'AND EXISTS(SELECT 1 FROM Transactions T INNER JOIN Pets P ON T.pet_id=P.petid WHERE T.ct_id=CT.userid AND P.category=$1 AND T.status=\'Confirmed\')';
var pc_avg_rate_filter = 'AND (SELECT AVG(rate) FROM Transactions T INNER JOIN Pets P ON T.pet_id=P.petid WHERE T.ct_id=CT.userid AND P.category=$1) >= $8'; // $8 = avg rating of the pet category;
var history_requested_filter = 'AND EXISTS(SELECT 1 FROM Transactions T INNER JOIN Pets P ON T.pet_id=P.petid WHERE T.ct_id=CT.userid AND P.owner=$9)'; // $9 = this userid
var history_confirmed_filter = 'AND EXISTS(SELECT 1 FROM Transactions T INNER JOIN Pets P ON T.pet_id=P.petid WHERE T.ct_id=CT.userid AND P.owner=$9 AND T.status=\'Confirmed\')';
var my_avg_rate_filter = 'AND (SELECT AVG(rate) FROM Transactions T INNER JOIN Pets P ON T.pet_id=P.petid where T.ct_id=CT.userid AND P.owner=$9) >= $10'; // $10 = avg rating by me;
var history_pet_requested_filter = 'AND EXISTS(SELECT 1 FROM Transactions T WHERE T.ct_id=CT.userid AND T.pet_id=$11)'; // $11 = this pet id
var history_pet_confirmed_filter = 'AND EXISTS(SELECT 1 FROM Transactions T WHERE T.ct_id=CT.userid AND T.pet_id=$11 AND T.status=\'Confirmed\')';
var safe_guard = 'AND $4 <> \'!\' AND $5 <> \'!\' AND $6 >= 0 AND $7 >= 0 AND $8 >= 0 AND $9 <> \'!\' AND $10 >= 0 AND $11 <> \'!\'';

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
var individual_request_query = 'SELECT send_request_success($1, $2, $3)'; // $1=petid, $2=s_date, $3=ct_id

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
var care_takers;

/* Filter/sort query */
var toggle_filter = "none";
var id_contains = "";
var name_contains = "";
var ft_pt = "";
var avg_rate = 0;
var can_take_care = false;
var daily_price = 10000;
var pc_experience = false;
var pc_avg_rate = 0;
var user_coll = "";
var my_avg_rate = 0;
var pet_coll = "";

/* Util */
var getString = (date) => date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
var refreshPage = (res) => {
	res.render('handle_transactions', {
		title: 'Find Care Taker for your ' + category + ' ' + petName,
		petid: petid,
		category: category,
		s_date: getString(s_date),
		e_date: getString(e_date),
		transfer_type: transfer_type,
		payment_method: payment_method,
		existing_transactions: existing_transactions,
		allocate_unsuccessful_msg: allocate_unsuccessful_msg(category),
		care_takers: care_takers,
		toggle_filter: toggle_filter,
		id_contains: id_contains,
		name_contains: name_contains,
		ft_pt: ft_pt,
		avg_rate: avg_rate,
		can_take_care: can_take_care,
		daily_price: daily_price,
		pc_experience: pc_experience,
		pc_avg_rate: pc_avg_rate,
		user_coll: user_coll,
		my_avg_rate: my_avg_rate,
		pet_coll: pet_coll
	});
}
var redirectHere = (res) => {
	res.redirect(url.format({
		pathname:"/handle_transactions/" + userid + "/" + petid + "/" + getString(s_date),
		query: {
			"allocate_unsuccessful": allocate_unsuccessful,
			"toggle_filter": toggle_filter,
			"id_contains": id_contains,
			"name_contains": name_contains,
			"ft_pt": ft_pt,
			"avg_rate": avg_rate,
			"can_take_care": can_take_care,
			"daily_price": daily_price,
			"pc_experience": pc_experience,
			"pc_avg_rate": pc_avg_rate,
			"user_coll": user_coll,
			"my_avg_rate": my_avg_rate,
			"pet_coll": pet_coll
		}
	}));
}
var readInput = (req) => {
	userid = req.params.userid;
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	toggle_filter = req.body.toggle_filter;
	id_contains = req.body.ct_id_contains.trim();
	name_contains = req.body.ct_name_contains.trim();
	ft_pt = req.body.ft_pt;
	avg_rate = req.body.avg_rate;
	can_take_care = req.body.can_take_care;
	daily_price = req.body.daily_price;
	pc_experience = req.body.pc_experience;
	pc_avg_rate = req.body.pc_avg_rate;
	user_coll = req.body.user_coll;
	my_avg_rate = req.body.my_avg_rate;
	pet_coll = req.body.pet_coll;
	allocate_unsuccessful = false;
}

/* Err msg */
var allocate_unsuccessful = false;
var allocate_unsuccessful_msg = (category) => allocate_unsuccessful && allocate_unsuccessful === true ? "* Sorry we cannot find any full-time care taker available declared " + category + " as a pet category that he or she can take care of." : "";

// GET
router.get('/:userid/:petid/:s_date', function(req, res, next) {
	userid = req.params.userid; //TODO: May need to update with session user id
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	allocate_unsuccessful = req.query.allocate_unsuccessful ? req.query.allocate_unsuccessful : false;
	toggle_filter = req.query.toggle_filter ? req.query.toggle_filter : "none";
	id_contains = req.query.id_contains ? req.query.id_contains : "";
	name_contains = req.query.name_contains ? req.query.name_contains : "";
	ft_pt = req.query.ft_pt ? req.query.ft_pt : "";
	avg_rate = req.query.avg_rate ? req.query.avg_rate : 0;
	can_take_care = req.query.can_take_care ? req.query.can_take_care : false;
	daily_price = req.query.daily_price ? req.query.daily_price : 10000;
	pc_experience = req.query.pc_experience ? req.query.pc_experience : false;
	pc_avg_rate = req.query.pc_avg_rate ? req.query.pc_avg_rate : 0;
	user_coll = req.query.user_coll ? req.query.user_coll : "";
	my_avg_rate = req.query.my_avg_rate ? req.query.my_avg_rate : 0;
	pet_coll = req.query.pet_coll ? req.query.pet_coll : "";
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
								pool.query(confirmed_transaction_query, [petid, getString(s_date)], (err, data) => {
									if (data.rows.length > 0) {
										res.redirect('/request/' + userid + '/' + petid + '/' + getString(s_date));
									}
								})
								if (data.rows.length > 0) {
									var request = data.rows[0];
									e_date = request.e_date;
									transfer_type = request.transfer_type;
									payment_method = request.payment_type;
									pool.query(existing_transaction_query, [petid, getString(s_date)], (err, data) => {
										existing_transactions = data.rows;
										pool.query(retrieve_ct_query() + safe_guard, [category, getString(s_date), getString(e_date), id_contains, name_contains, avg_rate, daily_price, pc_avg_rate, userid, my_avg_rate, petid], (err, data) => {
											care_takers = data.rows;
											refreshPage(res);
										})
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
	userid = req.params.userid; //TODO: session id
	petid = req.params.petid;
	s_date = new Date(req.params.s_date);
	pool.query(allocate_query, [petid, getString(s_date), getString(e_date)], (err, data) => {
		if (data.rows[0].allocate_success) {
			console.log("Allocated the a full-time care taker for request of petid from " + getString(s_date) + " to " + getString(e_date));
			allocate_unsuccessful = false;
			res.redirect('/request/' + userid + '/' + petid + '/' + getString(s_date));
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
	allocate_unsuccessful = false;
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
	allocate_unsuccessful = false;
	pool.query(delete_empty_request_qeury, [petid, s_date], (err, data) => {
		res.redirect('/request/' + userid + '/' + petid + '/' + getString(s_date));
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

router.post('/:userid/:petid/:s_date/request_all', function(req, res, next) {
	readInput(req);
	pool.query(request_all_query(), [category, getString(s_date), getString(e_date), id_contains, name_contains, avg_rate, daily_price, pc_avg_rate, userid, my_avg_rate, petid], (err, data) => {
		pool.query(clear_all_query, (err, data) => {
			redirectHere(res);
		})
	})
});

router.post('/:userid/:petid/:s_date/:ct_id/request', function(req, res, next) {
	readInput(req);
	var ct_id = req.params.ct_id;
	pool.query(individual_request_query, [petid, getString(s_date), ct_id], (err, data) => {
		if (data.rows[0].send_request_success) {
			console.log("Transaction confirmed");
			res.redirect('/request/' + userid + '/' + petid + '/' + getString(s_date));
		} else {
			redirectHere(res);
		}
	});
})

router.post('/:userid/:petid/:s_date/show_filtered', function(req, res, next) {
	readInput(req);
	redirectHere(res);
});

router.post('/:userid/:petid/:s_date/edit', function(req, res, next) {
	readInput(req);
	transfer_type = req.body.transfer;
	payment_method = req.body.payment;
	console.log(transfer_type);
	console.log(payment_method);
});

module.exports = router;

