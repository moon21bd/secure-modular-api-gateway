'use strict';

const Joi    = require('joi');
const config = require('../config');

config.engine.tasks = [
  {
    configId: [
      [1, 5],
      [7, 10],
      [16, 16],
      [23, 23],
    ],
    method: "POST",
    url: "http://order.platform.local/access/token",
    headers: {
      "Content-Type": "application/json",
    },
    body: '{"username":"platform_execution_engine@example.com","password":"test-password"}',
    validator: Joi.object().keys({
      token_type: Joi.string().required(),
      expires_in: Joi.number().required(),
      access_token: Joi.string().required(),
      refresh_token: Joi.string().required(),
    }),
    parser: function (response) {
      try {
        response = JSON.parse(response);
      } catch (e) {
        return false;
      }

      const validationResult = Joi.validate(response, this.validator);
      if (validationResult.error !== null) return false;

      return {
        data: {
          Authorization: response.token_type + " " + response.access_token,
        },
        ttl: response.expires_in / 2,
      };
    },
  },
  {
    configId: [[11, 12]],
    method: "POST",
    url: "https://api.example.com/api/authentication",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "email=system4@example.com&password=test-password&strategy=local",
    validator: Joi.object().keys({
      accessToken: Joi.string().required(),
    }),
    parser: function (response) {
      try {
        response = JSON.parse(response);
      } catch (e) {
        return false;
      }

      const validationResult = Joi.validate(response, this.validator);
      if (validationResult.error !== null) return false;

      return {
        data: {
          Authorization: "Bearer " + response.accessToken,
        },
        ttl: 1800,
      };
    },
  },
  {
    configId: [[26, 28]],
    method: "POST",
    url: "https://api.example.com/auth/access/token",
    headers: {
      "Content-Type": "application/json",
    },
    body: '{"username":"execution_engine@example.com","password":"test-password"}',
    validator: Joi.object().keys({
      token_type: Joi.string().required(),
      expires_in: Joi.number().required(),
      access_token: Joi.string().required(),
      refresh_token: Joi.string().required(),
    }),
    parser: function (response) {
      try {
        response = JSON.parse(response);
      } catch (e) {
        return false;
      }

      const validationResult = Joi.validate(response, this.validator);
      if (validationResult.error !== null) return false;

      return {
        data: {
          Authorization: response.token_type + " " + response.access_token,
        },
        ttl: response.expires_in / 2,
      };
    },
  },
];

module.exports = function(configId) {
    for (let taskId in config.engine.tasks) {
        let task = config.engine.tasks[taskId];
        for (let index in task.configId) {
            let range = task.configId[index];
            if (configId >= range[0] && configId <= range[1]) {
                return {id: taskId, task: task};
            }
        }
    }

    return false;
};
