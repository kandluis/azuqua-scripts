/*
* @Author: Edward & Luis
* @Date:   2016-08-01 15:39:03
* @Last Modified by:   luis
* @Last Modified time: 2016-08-01 18:53:26
*/

'use strict';

var _ = require("lodash")
  , request = require("request")
  , htmlparser = require("htmlparser");

function createDOM(rawHTML){
  var handler = new htmlparser.DefaultHandler(function(error, dom){
    if (error) {
      return;
    }
    return dom;
  });

  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(rawHTML);
  return handler.dom;
}

// Sorry, error prone.
function getCompany (inputString) {
    var array = inputString.split(".");
    var companyName;

    if (array.length == 3) {
        var someVariable = array[0];
        if (someVariable.includes("/")){
          var internalArray = someVariable.split("//");
          companyName = internalArray[1];
        }
        else {
          companyName = someVariable;
        }
    } else if (array.length == 4) {
        companyName = array[1];
    }

    if (companyName == "www" || companyName == undefined){
        companyName = "zendesk";
    }

    return companyName;
}


function extractCompanyNames(DOM, hashSet){
  if (!DOM) {
    return hashSet;
  }

  _.forEach(DOM, function(obj){
    // Assuming cite tag only has one child, which is a text node.
    if (obj.name == "cite") {
    }
    if (obj && obj.type == "tag" && obj.name == "cite" && obj.children.length > 0){
      var company = getCompany(obj.children[0].raw);
      hashSet[company] = true;
    }

    // recursively call on the children
    hashSet = extractCompanyNames(obj.children, hashSet);
  });

  return hashSet;
};

/**
 * Get's Google Search results for *.zendesk subdomain query beginning from start
 * @param  {int} start The result number from which to return results
 * @return {response}       response object from Google
 */
function queryGoogleFromStart(start, cb){
  request({
    uri: "https://www.google.com/search",
    method: "GET",
    qs: {
      start: start,
      q: "site:zendesk.com",
      num: 1000
    }
  }, function(err, res, body){
    console.log(body);
    var dom = createDOM(body);
    var res = extractCompanyNames(dom, {});
    cb(res);
  });
};


var MAXCALLS = 1;

function waitAndDo(pages, cb){
  if(pages >= MAXCALLS){
    return cb({});
  }

  setTimeout(function(){

    queryGoogleFromStart(pages * 10, function(hash){
      waitAndDo(pages + 1, function(res){
        return _.extend(res, hash);
      });
    });
  }, 50);
}

waitAndDo(0, function(res){
  console.lo
});
