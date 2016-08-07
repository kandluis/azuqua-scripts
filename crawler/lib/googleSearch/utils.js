/*
* @Author: Luis Perez
* @Date:   2016-08-05 12:14:51
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-05 20:13:11
*/

'use strict';

var _ = require("lodash")
  ,debug = require('debug')('scripts:crawler:googleSearch:utils')
  , htmlparser = require("htmlparser")
  , request = require("request")
  , url = require("url");

module.exports = function(dependencies){

  var CONST = dependencies.constants
    , argv = dependencies.argv;

  var utils = {
    /**
     * Given rawHTML, creates a manageable DOM object using htmlparser library.
     * @param  {string} rawHTML The input raw HTML.
     * @return {object}         Output DOM element.
     */
    createDOM: function(rawHTML){
      var handler = new htmlparser.DefaultHandler(function(error, dom){
        debug("Creating DOM from rawHTML...")
        if (error) {
          debug("Failed. The error is ", error);
          return;
        }
        return dom;
      });

      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(rawHTML);
      return handler.dom;
    },

    /**
     * Given an unput URL extracts the subdomain.
     * @param  {string} url Input site URL.
     * @return {string}     Subdomain from website.
     */
    getCompany: function(urlString) {

      debug("Extracting company from...", urlString);
      var host = url.parse(urlString).host;

      // successful parsing
      if(host) {
        var domains = host.split(".");

        // drop the top level domain and suffix
        var companyName = _.slice(domains, 0, domains.length - 2).join(".");
        debug("Extracted company name: ", companyName);

        return companyName;
      }

      // URL does not begin with https//, so we take subdomain
      return urlString.split(".")[0];
    },

    /**
     * Converts DOM into a HashSet counting the unique subdomains as well as their
     * relative popularity as ranked by Google.
     * @param  {object} DOM     htmlparse DOM object from Google Search Results.
     * @param  {object} hashSet Initial HashSet associating unique companies to
     * popularity.
     * @return {object}         HashSet
     */
    extractCompanyNames: function(DOM, hashSet){
      if (!DOM) {
        return hashSet;
      }

      _.forEach(DOM, function(obj){
        // Assuming cite tag only has one child, which is a text node.
        if (obj && obj.type == CONST.element && obj.name == CONST.type
          && obj.children.length > 0){
          var url = obj.children[0].raw;
          var company = utils.getCompany(url);
          if (hashSet[company]){
            hashSet[company].count = hashSet[company].count + 1;
          }
          else {
            hashSet[company] = {
              name: company,
              url: url,
              count: 1,
              ranking: _.size(hashSet)
            };
          }
        }

        // recursively call on the children
        hashSet = utils.extractCompanyNames(obj.children, hashSet);
      });

      return hashSet;
    },

    /**
     * Determines in the raw HTML is a bot page. Uses heuristics.
     * @param  {String}  Raw HTML for the page.
     * @return {Bool}
     */
    isBotURL: function(rawHTML){
      return rawHTML && rawHTML.length < CONST.heuristics.minValidHTMLLength;
    },


    /**
     * Returns a valid URI to be sent to obtain search results.
     * @param  {int} start The results from which the results should begin their return.
     * @return {object}       The URI object.
     */
    constructURICall: function(start){
      return {
        uri: CONST.searchParams.uri,
        method: CONST.searchParams.method,
        qs: {
          start: start,
          q: "site:" + argv.d,
          num: argv.n > 0 ? argv.n : 10
        }
      };
    },

    /**
     * Processes the retrieved response from the Google Search API.
     * @param  {object} err  The error response. Set to null if successful.
     * @param  {object} res  Contains the retrieved response
     * @param  {object} body Contains the extracted body from the response
     * @return {object}      Hashset with company names retrieved from the response.
     */
    processResponse: function(err, res, body){
      var results = {};
      if (err){
        debug("Error requesting Google results. Error: ", err);
      }
      debug("Initial returned request ", body.substring(0, dependencies.constants.debugOptions.maxOutLength));

      if(!utils.isBotURL(body)){
        var dom = utils.createDOM(body);

        debug("Extracting company names from ", dom);

        var results = utils.extractCompanyNames(dom, {});

        debug("Finished extraction...");

        return results;
      }

      console.log("Hit a bot test page. Please visit: ", res.request.uri.href);

      return null;
    },

    /**
     * Get's Google Search results for *.zendesk subdomain query beginning from
     * start
     * @param  {int}      start     The result number from which to return results
     * @param  {function} [varname] Function passed results containing extracted
     * companies hash.
     */
    queryGoogleFromStart: function(start, next){
      var URI = utils.constructURICall(start);

      console.log("Preparing to request Google Search...", start);
      debug(URI);

      request(URI, function(err, res, body){
        var results = utils.processResponse(err, res, body);
        return next(results);
      });
    }
  };

  return utils;
}