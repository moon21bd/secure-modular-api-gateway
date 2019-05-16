'use strict';

const db       = require('../../resources/database.connection');
const resGen   = require('../../lib/result.codes');
const utils    = require('../../lib/utils');

const queries  = require('./queries');

module.exports = {
    createBanner: function (createFields, container, callback) {
        const replacements = [
            createFields.bannerType, createFields.title, createFields.subTitle, createFields.description,
            createFields.bannerPic, createFields.deepLink, createFields.roleId || 0,
            createFields.nationality || 'NA', createFields.channel || 'NA', createFields.createdBy
        ];
        db.mysql.query(queries.createBanner, replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            container.bannerId = results.insertId;
            return callback();
        });
    },
    updateBanner: function (updatedFields, callback) {
        const replacements = [
            updatedFields.bannerType, updatedFields.bannerType, updatedFields.title, updatedFields.title,
            updatedFields.subTitle, updatedFields.subTitle, updatedFields.description, updatedFields.description,
            updatedFields.status, updatedFields.status, updatedFields.bannerPic, updatedFields.bannerPic,
            updatedFields.deepLink, updatedFields.deepLink, updatedFields.roleId, updatedFields.roleId,
            updatedFields.nationality, updatedFields.nationality, updatedFields.channel, updatedFields.channel,
            updatedFields.updatedBy, updatedFields.bannerId
        ];

        db.mysql.query(queries.updateBanner, replacements, function (err, results, fields) {
            if (err) {
                return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
            }

            if (results.affectedRows === 0) {
                return callback(resGen.responseGenerator(resGen.ACTION_FAILED_ERR, 'Banner update failed'));
            }

            return callback();
        });
    },
    fetchBannerListWithFilters: function ({bannerId, roleId, nationality, channel}, container, callback) {
        const condition = utils.generateDynamicWhereCondition(
            ['banner_id', 'banner_role_id', 'banner_nationality', 'banner_channel'],
            [bannerId, roleId, nationality, channel]
        );

        db.mysql.query(queries.bannerListWithFilters(condition.whereCondition), condition.replacements,
            function (err, results, fields) {
                if (err) {
                    return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
                }

                container.push(...results);
                return callback();
        });
    },
    fetchBannerList: function ({roleId, nationality, channel}, container, callback) {
        roleId = roleId || 0;
        nationality = nationality || 'NA';
        channel = channel || 'NA';

        db.mysql.query(queries.bannerList, [roleId, nationality, channel], function (err, results, fields) {
           if (err) {
               return callback(resGen.responseGenerator(resGen.INTERNAL_SERVER_ERROR, err));
           }

           container.push(...results);
           return callback();
        });
    }
};
