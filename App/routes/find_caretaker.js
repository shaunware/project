var express = require('express');
var router = express.Router();
require('dotenv').config({path: __dirname + '/../.env'});

const { Pool } = require('pg')
const pool = new Pool({connectionString:process.env.DATABASE_URL})

/* SQL Query */
var all_petowner_query = 'SELECT userid FROM PetOwners';
var petowner_exist_query = 'SELECT 1 FROM PetOwners WHERE userid=$1'
var pet_exist_query = 'SELECT * FROM Pets WHERE petid=$1 AND owner=$2';
var all_caretaker_query = 'SELECT ct.userid AS userid, name, rating, daily_price,\n' +
	'       CASE\n' +
	'           WHEN EXISTS(SELECT 1 FROM FullTimeCareTakers fct WHERE fct.userid=ct.userid) THEN \'Full-time\'\n' +
	'           ELSE \'Part-Time\'\n' +
	'           END\n' +
	'                 AS category\n' +
	'FROM ((SELECT userid, rating\n' +
	'      FROM CareTakers\n' +
	'      WHERE NOT EXISTS(SELECT 1 FROM CannotTakeCare WHERE ct_id=userid AND category=$1)) ct\n' +
	'    NATURAL JOIN (SELECT userid, name FROM Users) us)\n' +
	'    LEFT JOIN (SELECT ct_id, daily_price FROM CanTakeCare) ctc ON ct.userid=ctc.ct_id;' //all caretakers can take care of this category of pet
/*
all_caretaker_query =
SELECT ct.userid AS userid, name, rating, daily_price,
       CASE
           WHEN EXISTS(SELECT 1 FROM FullTimeCareTakers fct WHERE fct.userid=ct.userid) THEN 'Full-time'
           ELSE 'Part-Time'
           END
       AS category
FROM ((SELECT userid, rating
      FROM CareTakers
      WHERE NOT EXISTS(SELECT 1 FROM CannotTakeCare WHERE ct_id=userid AND category=$1)) ct
    NATURAL JOIN (SELECT userid, name FROM Users) us)
    LEFT JOIN (SELECT ct_id, daily_price FROM CanTakeCare) ctc ON ct.userid=ctc.ct_id;
 */

/* Data */
var userid;
var petid;
var pet;
var petName;
var category;
var requirements;
var petOwners;
var careTakers;
var s_date = new Date();
var e_date;

/* Util */
var getString = (date) => date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();

/* Err msg */
var connectionSuccess;
var isPetOwner;
var isValidPet;

// GET
router.get('/:userid/:petid', function(req, res, next) {
	userid = req.params.userid; //TODO: May need to update with session user id
	petid = req.params.petid;
	pool.query(all_petowner_query, (err, data) => {
		if (err !== undefined) {
			connectionSuccess = false;
		} else {
			connectionSuccess = true;
			petOwners = data.rows;
		}
	});
	if (connectionSuccess) {
		pool.query(petowner_exist_query, [userid], (err, data) => {
			isPetOwner = data.rows.length > 0;
		});
		if (isPetOwner) {
			pool.query(pet_exist_query, [petid, userid], (err, data) => {
				isValidPet = data.rows.length > 0;
				pet = data.rows;
			})
			if (isValidPet) {
				petName = pet[0].name;
				category = pet[0].category;
				requirements = pet[0].requirements;
				e_date = new Date(s_date);
				e_date.setDate(s_date.getDate() + 7);
				pool.query(all_caretaker_query, [category], (err, data) => {
					careTakers = data.rows;
				})
				res.render('find_caretaker', {
					title: 'Find Care Taker for ' + petName,
					category: category,
					requirements: requirements,
					careTakers: careTakers,
					s_date: getString(s_date),
					e_date: getString(e_date)
				});
			} else {
				res.render('not_found_error', {component: 'petid'});
			}
		} else {
			res.render('not_found_error', {component: 'userid'});
		}
	} else {
		res.render('connection_error');
	}
});

// POST
router.post('/:userid/:petid', function(req, res, next) {
	petid = req.params.petid;
});

module.exports = router;
