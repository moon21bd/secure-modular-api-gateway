"use strict";

const resDet = require("../lib/result.details");
const common = require("../components/common");
const request = require("request");
const async = require("async");
const resGen = require("../lib/result.codes");
const config = require("../config");
let callback = common.callback;
const querystring = require("querystring");

const smsDetails = {
  otp: {
    88: {
      // body: "Here is your otp: $$otp$$",
      body: "PLATFORM: Your OTP is $$otp$$. Please do not share your OTP with anyone.",
    },
    6: {
      // body: 'Here is your otp: $$otp$$',
      body: "PLATFORM: Your OTP is $$otp$$. Please do not share your OTP with anyone.",
    },
    common: {
      // body: "Here is your otp: $$otp$$",
      body: "PLATFORM: Your OTP is $$otp$$. Please do not share your OTP with anyone.",
    },
    digi: {
      // body: "Your OTP code is $$otp$$. Please do not share your OTP code with anyone.",
      body: "PLATFORM: Your OTP is $$otp$$. Please do not share your OTP with anyone.",
    },
  },
};
const smsChannel = {
  88: {
    func: sendSmsBd,
    options: {
      url: "https://sms.provider.example/api/send",
      masking: "replace-me",
      userName: "platform",
      password: process.env.PASSWORD || "replace-me",
    },
  },
  6: {
    func: sendSmsCountryB,
    options: {
      url: "https://sms.provider.example/api/send?",
      user: "dlsb2",
      pass: "qFLd!5mB",
      type: 0 /*0 for Ascii code and 5 for unicode*/,
      from: "Platform",
      servid: "MES01",
    },
  },
  common: {
    func: sendGlobalSms,
    options: {
      url: "https://rest.clicksend.com/v3/sms/send",
      userName: "sms.api@example.com",
      password: process.env.PASSWORD || "replace-me",
      body: "",
      to: "",
      from: "",
    },
  },

  digiPayment: {
    func: sendSmsPartner,
    options: {
      //url: 'http://localhost:8001/',
      //url: 'https://internal-service.example/platform_partner_request.php/',
      url: "https://internal-service.example/platform_partner_request.php/",
      //url: "https://internal-service.example/smsgw/SendSMS_OTP/SendSingleSMS.php?UserName=REPLACE_ME&Password=REPLACE_ME&Sender=20000&text=",
      type: "staging",
    },
  },
};

function sendSmsBd(number, smsBody, options, callback) {
  try {
    let requestDetails = Object.assign({}, options);
    console.log("inside sms BD===");
    console.log(requestDetails);
    if (!options || !options.url) {
      return callback(
        resGen.responseGenerator(
          resGen.REQUIRED_PARAMS_ERR,
          "No Request-URL found"
        )
      );
    }

    let url = requestDetails.url;
    delete requestDetails.url;
    requestDetails.receiver = number;
    requestDetails.message = smsBody;

    const searchParams = querystring.stringify(requestDetails);

    request(
      {
        url: url + searchParams,
        method: "GET",
      },
      function (err, response, body) {
        if (err) {
          return callback(
            resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
          );
        }
        /* config.logger.info(
                'URL: ' + "Sms send Country A through the SMS provider" +
                ', Request: ' + url + searchParams +
                ', Response: ' + JSON.stringify(response)
            ); */

        if (response.body) {
          var responseStr = response.body;
          var res = JSON.parse(responseStr);
        }
        console.log(res);
        if (res[0].success === 1) {
          return callback();
        } else {
          return callback(
            resGen.responseGenerator(
              resGen.ACTION_FAILED_ERR,
              "Something went wrong in time of Sending sms"
            )
          );
        }
      }
    );
  } catch (e) {
    console.log(e);
    return callback(
      resGen.responseGenerator(
        resGen.ACTION_FAILED_ERR,
        "Sms was not sent to user"
      )
    );
  }
}

function sendSmsCountryB(number, smsBody, options, callback) {
  try {
    let requestDetails = Object.assign({}, options);

    if (!options || !options.url) {
      return callback(
        resGen.responseGenerator(
          resGen.REQUIRED_PARAMS_ERR,
          "No Request-URL found"
        )
      );
    }
    //let requestDetails = options;
    let url = requestDetails.url;
    delete requestDetails.url;
    requestDetails.to = number;
    requestDetails.text = smsBody;
    requestDetails.title = "Platform";
    const searchParams = querystring.stringify(requestDetails);

    request(
      {
        url: url + searchParams,
        method: "GET",
      },
      function (err, response, body) {
        if (err) {
          return callback(
            resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
          );
        }
        /* config.logger.info(
                'URL: ' + "Sms send Country B through the SMS provider" +
                ', Request: ' + url + searchParams +
                ', Response: ' + JSON.stringify(response)
            ); */

        if (response.body) {
          var responseStr = response.body;
          var res = responseStr.split(",");
        }
        if (res[2] === "200") {
          return callback();
        } else {
          return callback(
            resGen.responseGenerator(
              resGen.ACTION_FAILED_ERR,
              "Something went wrong in time of sending sms"
            )
          );
        }
      }
    );
  } catch (e) {
    return callback(
      resGen.responseGenerator(
        resGen.ACTION_FAILED_ERR,
        "Sms was not sent to user"
      )
    );
  }
}

function sendSmsPartner(number, smsBody, options, callback) {
  try {
    let requestDetails = Object.assign({}, options);
    console.log("inside sms digi===", requestDetails);
    if (!options || !options.url) {
      return callback(
        resGen.responseGenerator(
          resGen.REQUIRED_PARAMS_ERR,
          "No Request-URL found"
        )
      );
    }

    let url = requestDetails.url;
    let queryParam = `${number}|${smsBody}|BDALERTMT|${new Date().getTime()}&operator=1`;
    if (requestDetails.type && requestDetails.type == "staging") {
      queryParam = `?MSISDN=${number}&text=${queryParam}`;
    }
    console.log("url + queryParam: ", url + queryParam);
    request(
      {
        url: url + queryParam,
        method: "GET",
      },
      function (err, response, body) {
        if (err) {
          return callback(
            resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
          );
        }
        /* config.logger.info(
                'URL: ' + "Sms send country B through" +
                ', Request: ' + url + queryParam +
                ', Response: ' + JSON.stringify(response)
            ); */

        if (response.body === "Successfully inserted to smsoutbox") {
          return callback();
        } else {
          return callback(
            resGen.responseGenerator(
              resGen.ACTION_FAILED_ERR,
              "Something went wrong in time of Sending sms"
            )
          );
        }
      }
    );
  } catch (e) {
    console.log(e);
    return callback(
      resGen.responseGenerator(
        resGen.ACTION_FAILED_ERR,
        "Sms was not sent to user"
      )
    );
  }
}

function sendGlobalSms(number, smsBody, options, callback) {
  console.log("number:", number, ":", "smsBody:", smsBody);
  try {
    let requestDetails = Object.assign({}, options);

    const credentials = {
      userName: options.userName,
      password: options.password,
    };

    if (!requestDetails.url) {
      return callback(
        resGen.responseGenerator(
          resGen.REQUIRED_PARAMS_ERR,
          "No Request-URL found"
        )
      );
    }

    let uri = requestDetails.url;
    requestDetails.to = number;
    requestDetails.body = smsBody;

    const authString = `${credentials.userName}:${credentials.password}`; // AUTHORIZATION : BASIC AUTH
    const encodedStringWithBase64 = Buffer.from(authString).toString("base64");

    request(
      {
        url: uri,
        method: "POST",
        headers: {
          Authorization: `Basic ${encodedStringWithBase64}`,
          "Content-Type": "application/json",
        },
        json: true,
        body: {
          messages: [
            {
              body: requestDetails.body,
              to: requestDetails.to,
              from: requestDetails.from,
            },
          ],
        },
      },
      function (err, response, body) {
        console.log("BODY:", body);

        if (err) {
          console.log("ERROR in SMS:", err);
          return callback(
            resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
          );
        }

        config.logger.info(
          "URL: " +
            "Sms send globally with click send" +
            ", Request: " +
            requestDetails.url +
            ", Response: " +
            JSON.stringify(response)
        ); // writing a log for future debug..

        if (response.statusCode === 200) {
          return callback();
        } else if (response.statusCode >= 400 && response.statusCode <= 405) {
          return callback(
            resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err)
          );
        }
      }
    );
  } catch (e) {
    console.log("ERROR  IN SENDING SMS:", e);
    return callback(
      resGen.responseGenerator(
        resGen.ACTION_FAILED_ERR,
        "Failed to send SMS to the user"
      )
    );
  }
}

function secondsToHms(d) {
  d = Number(d);
  let h = Math.floor(d / 3600);
  let m = Math.floor((d % 3600) / 60);
  let s = Math.floor((d % 3600) % 60);

  let hDisplay = h > 0 ? h + (h === 1 ? " hour" : " hours") : "";
  let mDisplay = m > 0 ? m + (m === 1 ? ", minute" : ", minutes") : "";
  let sDisplay = s > 0 ? s + (s === 1 ? ", second" : ", seconds") : "";
  return hDisplay + mDisplay + sDisplay;
}

function generateBody(countryCode, messageType, dynamicValues) {
  let message = "";

  message = smsDetails[messageType][countryCode]
    ? smsDetails[messageType][countryCode]["body"]
    : smsDetails[messageType]["common"]["body"];

  for (let key in dynamicValues) {
    if (dynamicValues.hasOwnProperty(key)) {
      var place = "$$" + key + "$$";
      message = message.replace(place, dynamicValues[key]);
    }
  }
  return message;
}

module.exports = {
  generateBody: generateBody,
  smsDetails,
  smsChannel,
};
