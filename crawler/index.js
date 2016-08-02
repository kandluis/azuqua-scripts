var a = "https://azuqua.zendesk.com";
var b = "https://www.edwardszczepanski.zendesk.com";
var c  = "http://www.zendesk.com";
var d  = "http://zendesk.com";




function awesome (inputString) {
    var array = inputString.split(".");
    var companyName;

    if (array.length == 3) {
        var someVariable = array[0];
        var internalArray = someVariable.split("//");
	companyName = internalArray[1];
    } else if (array.length == 4) {
        companyName = array[1];
    }

    if (companyName == "www" || companyName == undefined){
        companyName = "zendesk";
    }

    return companyName;
}


console.log(awesome(a));
console.log(awesome(b));
console.log(awesome(c));
console.log(awesome(d));
