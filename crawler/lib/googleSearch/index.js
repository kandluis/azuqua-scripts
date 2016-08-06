/*
* @Author: Luis Perez
* @Date:   2016-08-05 12:22:56
* @Last Modified by:   Luis Perez
* @Last Modified time: 2016-08-05 16:28:46
*/

'use strict';

var debug = require('debug')('scripts:crawler:googleSearch');

module.exports = function(dependencies){
  var argv = dependencies.argv
    , CONST = dependencies.constants
    , utils = require("./utils")(dependencies);

  /**
   * Recursively and asynchronously sends out Google requests.
   * @param  {int}   req_num     The current request number.
   * @param  {object}   results  The results calculated thusfar.
   * @param  {Function} callback Called with final results.
   * @return {bool}            True on success.
   */
  function recursiveCallback(req_num, results, callback){
    debug("req_num page: ", req_num);

    if(req_num >= argv.m){
      callback(null, results);
      return true;
    }

    // Set a random wait time if specified by the user to attempt to bypass Google's
    // bot detection.
    var rand = (argv.b) ?
      Math.round(Math.random() * CONST.latency.variance) + CONST.latency.mean : 0;
    console.log("Setting timeout to ", rand, "ms");
    setTimeout(function(){
      utils.queryGoogleFromStart(req_num * argv.n, function(res) {
        // Bubble up, error occurred, salvage results!
        if(!res){
          return callback(null, results);
        }
        // bump ranking of new results by length of old results
        var currRanking = _.size(results);
        var bumpedRes = _.transform(res, function(acc, val, key){
          acc[key] = _.extend(val, { ranking: val.ranking + currRanking });
        }, {});
        recursiveCallback(req_num + 1, _.mergeWith(results, bumpedRes, function(objVal, srcVal){
          if (!objVal) return srcVal;
          if (!srcVal) return objVal;
          return _.extend(objVal, {
            count: objVal.count + srcVal.count,
            ranking: _.min([objVal.ranking, srcVal.ranking])
          });
        }), callback);
      })
    }, rand);
  }

  // See README.md for details on the purpose of these functions.
  return {
    run: function(callback) {
      recursiveCallback(argv.s, {}, callback);
    },

    keysToColumnMapping: function(){
      return {
        name: "Company",
        count: "Times Encountered",
        ranking: "Ranking",
        url: "URL"
      }
    },

    prefix: function(){
      return "gs";
    }
  };
}