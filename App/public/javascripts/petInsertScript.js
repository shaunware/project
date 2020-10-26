function check(event) {
	// Get Values
	var petid  = document.getElementById('petid' ).value;
	//var name    = document.getElementById('name'   ).value;
	//var category = document.getElementById('category').value;
	//var requirements = document.getElementById('requirements').value;
	if (petid.length < 3) {
		alert("Invalid matric number");
		event.preventDefault();
		event.stopPropagation();
		return false;
	}
/*
	alert(userid);
	alert("hasfasf");
	console.log(userid);
	event.preventDefault();
	event.stopPropagation();
	return false;
	
	// Simple Check
	/*
	if(matric.length != 9) {
		alert("Invalid matric number");
		event.preventDefault();
		event.stopPropagation();
		return false;
	}
	if(name.length == 0) {
		alert("Invalid name");
		event.preventDefault();
		event.stopPropagation();
		return false;
	}
	if(faculty.length != 3) {
		alert("Invalid faculty code");
		event.preventDefault();
		event.stopPropagation();
		return false;
	}*/

}