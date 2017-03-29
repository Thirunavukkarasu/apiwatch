'use strict';

var rp = require('request-promise');
var Q  = require('q');
var fs = require('fs');
var nodemailer = require('nodemailer');
var config     =  require('./config');
var EmailTemplate = require('email-templates').EmailTemplate;
var path = require('path');
var _ = require('lodash');
var Handlebars = require('handlebars');
var templateDir = path.join(__dirname, 'templates', 'api-health');
var apiHealth = new EmailTemplate(templateDir);

Handlebars.registerHelper("inc", function(value, options){
    return parseInt(value) + 1;
});

/**
	Read apis.json file from fileSystem using fs module
**/
function getAllApis(){
	return JSON.parse(fs.readFileSync(config.apiConfigFile, 'utf8'));
}

/**
	Iterate through the configured apis and check its availability
**/
function validateApis(apis) {
	var promises = apis.map(function(api){
		var deferred = Q.defer();

		rp(api)
		.then(function (responseData,a,b) {
		   deferred.resolve({
		   	  status       : "SUCCESS",
		   	  api          : api,
		   	  responseData : responseData
		   });
		})
		.catch(function (responseData) {
		   deferred.resolve({
		   	  status       : "FAILURE",	
		   	  api          : api,
		   	  responseData : responseData
		   });
		});

		return deferred.promise;	
	});

  	return Q.all(promises)
  	.then(function(promiseData){
  		sendMail(promiseData);
    });
}

function sendMail(promiseData){
	// create reusable transporter object using the default SMTP transport
	var transporter = nodemailer.createTransport({
		 host: config.smtp.hostname
	});

	apiHealth.render({"promiseData":promiseData}, function (err, result) {
		if(err){
			console.log(err);
			return;
		}		
		// setup e-mail data with unicode symbols
		var mailOptions = {
		    from    :  config.mailDetails.from, 
		    to      :  config.mailDetails.to, 
		    subject : 'RDEcoSystem API Health status ✔', 
		    text    : 'Enclosed below the health report of all the RDEcoSystem APIs', 
		    html    :  result.html 
		};		

  		// send mail with defined transport object
		transporter.sendMail(mailOptions, function(error, info){
		    if(error){
		        return console.log(error);
		    }
		    console.log('Message sent: ' + info.response);
		});
	});
}

var allApis = getAllApis();
validateApis(allApis);