var express = require('express');
var router = express.Router();

const { Pool } = require('pg')
/* --- V7: Using Dot Env ---
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: '********',
  port: 5432,
})
*/
const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});


/* SQL Query */
var sql_query = 'SELECT * FROM student_info WHERE matric=$1';

router.get('/', function(req, res, next) {
	pool.query(sql_query, ['A0000001A'], (err, data) => {
		console.log(err);
		res.render('select', { title: 'Database Connect', data: data.rows });
	});
});

module.exports = router;
